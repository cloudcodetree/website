import { Stack } from 'aws-cdk-lib';
import { HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { MainStackProps } from '../../main';
import { prefixer } from '../../utils/utils';

export class Route53Stack extends Stack {
  readonly hostedZone: IHostedZone;

  constructor(scope: Stack, id: string, props: MainStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    this.hostedZone = HostedZone.fromLookup(
      this,
      `${prefixer('hosted-zone')}`,
      {
        domainName,
      }
    );
  }
}
