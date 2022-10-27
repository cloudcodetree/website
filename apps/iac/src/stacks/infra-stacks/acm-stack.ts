import { Stack, CfnOutput } from 'aws-cdk-lib';

import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { MainStackProps } from '../../main';

import { prefixer } from '../../utils/utils';

export interface AcmStackProps extends MainStackProps {
  hostedZone: IHostedZone;
}

export class AcmStack extends Stack {
  readonly certificate: Certificate;
  readonly certificateArn: string;

  constructor(scope: Stack, id: string, props: AcmStackProps) {
    super(scope, id, props);

    const { domainName, hostedZone } = props;

    this.certificate = new Certificate(this, `${prefixer('wildcard-cert')}`, {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });
    this.certificateArn = this.certificate.certificateArn;
    new CfnOutput(this, `${prefixer('cert-arn')}`, {
      value: this.certificateArn,
    });
  }
}
