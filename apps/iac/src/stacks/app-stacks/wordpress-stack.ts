import { Stack, Duration } from 'aws-cdk-lib';
import {
  IVpc,
  InstanceType,
  InstanceClass,
  InstanceSize,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraMysqlEngineVersion,
  Credentials,
} from 'aws-cdk-lib/aws-rds';
import { FileSystem } from 'aws-cdk-lib/aws-efs';
import { ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { IHostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { HttpsRedirect } from 'aws-cdk-lib/aws-route53-patterns';
import { MainStackProps } from '../../main';
import { prefixer } from '../../utils/utils';

export interface WordpressStackProps extends MainStackProps {
  hostedZone: IHostedZone;
  certificate: Certificate;
  vpc: IVpc;
}

export class WordpressStack extends Stack {
  constructor(scope: Stack, id: string, props: WordpressStackProps) {
    super(scope, id, props);

    const { domainName, vpc, hostedZone, certificate } = props;

    const credSecret = new Secret(this, `${prefixer('db-secret')}`, {
      secretName: '/wordpress-db',
      generateSecretString: {
        passwordLength: 20,
        excludePunctuation: true,
      },
    });
    const db = new DatabaseCluster(this, `${prefixer('wp-db-stack')}`, {
      engine: DatabaseClusterEngine.auroraMysql({
        version: AuroraMysqlEngineVersion.VER_2_10_1,
      }),
      instanceProps: {
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
        vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
      credentials: Credentials.fromPassword('chris', credSecret.secretValue),
      defaultDatabaseName: 'wordpress',
    });
    const fs = new FileSystem(this, `${prefixer('fx-stack')}`, {
      fileSystemName: 'wordpress',
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    const wp = new ApplicationLoadBalancedFargateService(
      this,
      `${prefixer('wp-srv')}`,
      {
        taskImageOptions: {
          image: ContainerImage.fromRegistry('library/wordpress:latest'),
          environment: {
            WORDPRESS_DB_NAME: 'wordpress',
            WORDPRESS_DB_USER: 'chris',
            WORDPRESS_DB_PASSWORD: credSecret.secretValue.unsafeUnwrap(),
            WORDPRESS_DB_HOST: db.clusterEndpoint.hostname,
            WORDPRESS_TABLE_PREFIX: 'wp_',
          },
        },
        cpu: 256,
        memoryLimitMiB: 1024,
        vpc,
        taskSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        publicLoadBalancer: true,
        certificate,
        redirectHTTP: true,
      }
    );

    db.connections.allowDefaultPortFrom(wp.service.connections);
    fs.connections.allowDefaultPortFrom(wp.service.connections);
    wp.taskDefinition.addVolume({
      efsVolumeConfiguration: {
        fileSystemId: fs.fileSystemId,
      },
      name: `${prefixer('wp-vol')}`,
    });
    wp.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: '/var/www/html',
      readOnly: false,
      sourceVolume: `${prefixer('wp-vol')}`,
    });
    wp.targetGroup.configureHealthCheck({
      path: '/',
      healthyHttpCodes: '200-399',
    });
    const targetScaling = wp.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    targetScaling.scaleOnCpuUtilization('cpuScaling', {
      targetUtilizationPercent: 75,
    });

    targetScaling.scaleOnMemoryUtilization('memoryScaling', {
      targetUtilizationPercent: 75,
    });

    new ARecord(this, `${prefixer('wp-a-record')}`, {
      recordName: 'blog',
      zone: hostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(wp.loadBalancer)),
      ttl: Duration.minutes(1),
    });

    new HttpsRedirect(this, `${prefixer('wordpress-redirect')}`, {
      recordNames: [domainName],
      targetDomain: `blog.${domainName}`,
      zone: hostedZone,
    });
  }
}
