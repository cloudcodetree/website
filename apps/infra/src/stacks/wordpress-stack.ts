import { Stack, App, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import {
  Vpc,
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
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { HttpsRedirect } from 'aws-cdk-lib/aws-route53-patterns';
import { AppStackProps } from './app-stack';

export class WordpressStack extends Stack {
  constructor(scope: App, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { prefix, domainName } = props;

    const hostedZone = HostedZone.fromLookup(this, `${prefix}-hosted-zone`, {
      domainName,
    });

    const certificate = new Certificate(this, `${prefix}-wildcard-cert`, {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const certificateArn = certificate.certificateArn;
    new CfnOutput(this, 'CertificateArn', {
      value: certificateArn,
    });

    const vpc = new Vpc(this, `${prefix}-vpc`);
    const credSecret = new Secret(this, `${prefix}-db-secret`, {
      secretName: '/wordpress-db',
      generateSecretString: {
        passwordLength: 20,
        excludePunctuation: true,
      },
    });
    const db = new DatabaseCluster(this, `${prefix}-wp-db`, {
      engine: DatabaseClusterEngine.auroraMysql({
        version: AuroraMysqlEngineVersion.VER_3_02_1,
      }),
      instanceProps: {
        instanceType: InstanceType.of(InstanceClass.R5, InstanceSize.LARGE),
        vpc,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
      credentials: Credentials.fromPassword('chris', credSecret.secretValue),
      defaultDatabaseName: 'wordpress',
    });
    const fs = new FileSystem(this, `${prefix}-fx`, {
      fileSystemName: 'wordpress',
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    const wp = new ApplicationLoadBalancedFargateService(
      this,
      `${prefix}-wp-srv`,
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
      name: `${prefix}-wp-vol`,
    });
    wp.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: '/var/www/html',
      readOnly: false,
      sourceVolume: `${prefix}-wp-vol`,
    });
    wp.targetGroup.configureHealthCheck({
      path: '/',
      healthyHttpCodes: '200-399',
    });
    const targetScaling = wp.service.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 40,
    });

    targetScaling.scaleOnCpuUtilization('cpuScaling', {
      targetUtilizationPercent: 75,
    });

    targetScaling.scaleOnMemoryUtilization('memoryScaling', {
      targetUtilizationPercent: 75,
    });

    new ARecord(this, `${prefix}-wp-a-record`, {
      recordName: 'blog',
      zone: hostedZone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(wp.loadBalancer)),
      ttl: Duration.minutes(1),
    });

    new HttpsRedirect(this, `${prefix}-wordpress-redirect`, {
      recordNames: [domainName],
      targetDomain: `blog.${domainName}`,
      zone: hostedZone,
    });
  }
}
