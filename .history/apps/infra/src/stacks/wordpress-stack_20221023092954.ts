// import * as ec2 from '@aws-cdk/aws-ec2';
// import * as ecs from '@aws-cdk/aws-ecs';
// import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
// import * as efs from '@aws-cdk/aws-efs';
// import * as rds from '@aws-cdk/aws-rds';
// import * as secretsManager from '@aws-cdk/aws-secretsmanager';
import { Stack, App, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import {
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraMysqlEngineVersion,
} from 'aws-cdk-lib/aws-rds';

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
    const db = new DatabaseCluster(this, 'wp-db', {
      engine: DatabaseClusterEngine.auroraMysql({
        version: AuroraMysqlEngineVersion.VER_5_7_12,
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.R5,
          ec2.InstanceSize.LARGE
        ),
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
      },
      credentials: rds.Credentials.fromPassword(
        'matthew',
        credSecret.secretValue
      ),
      defaultDatabaseName: 'wordpress',
    });
  }
}