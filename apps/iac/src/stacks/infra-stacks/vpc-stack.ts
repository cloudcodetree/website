import { Stack } from 'aws-cdk-lib';
import { IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';
import { MainStackProps } from '../../main';
import { prefixer } from '../../utils/utils';

export class VpcStack extends Stack {
  readonly vpc: IVpc;

  constructor(scope: Stack, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, `${prefixer('vpc')}`);
  }
}
