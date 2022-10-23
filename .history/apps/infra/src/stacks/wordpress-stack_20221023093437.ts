// import * as ec2 from '@aws-cdk/aws-ec2';
// import * as ecs from '@aws-cdk/aws-ecs';
// import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
// import * as efs from '@aws-cdk/aws-efs';
// import * as rds from '@aws-cdk/aws-rds';
// import * as secretsManager from '@aws-cdk/aws-secretsmanager';
import { Stack, App, StackProps } from 'aws-cdk-lib';
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
import {} from 'aws-cdk-lib/aws-';

export class WordpressStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, `cct-vpc`);
    const credSecret = new Secret(this, `cct-db-secret`, {
      secretName: '/wordpress-db',
      generateSecretString: {
        passwordLength: 20,
        excludePunctuation: true,
      },
    });
    const db = new DatabaseCluster(this, `cct-wp-db`, {
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
    const fs = new FileSystem(this, `ctt-fx`, {
      fileSystemName: 'wordpress',
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
    });
    const wp = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'wpsvc',
      {
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('library/wordpress:latest'),
          environment: {
            WORDPRESS_DB_NAME: 'wordpress',
            WORDPRESS_DB_USER: 'matthew',
            WORDPRESS_DB_PASSWORD: credSecret.secretValue.toString(),
            WORDPRESS_DB_HOST: db.clusterEndpoint.hostname,
            WORDPRESS_TABLE_PREFIX: 'wp_',
          },
        },
        cpu: 256,
        memoryLimitMiB: 1024,
        vpc,
        taskSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
      }
    );
  }
}
