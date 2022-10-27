import { Stack, App, StackProps } from 'aws-cdk-lib';
import { WordpressStack } from './stacks/app-stacks/wordpress-stack';
import { AcmStack } from './stacks/infra-stacks/acm-stack';
import { Route53Stack } from './stacks/infra-stacks/route53-stack';
import { VpcStack } from './stacks/infra-stacks/vpc-stack';
import { config, prefixer } from './utils/utils';

const app = new App();

const domainName = `cloudcodetree.com`;
const company = `ctt`;
const stage = `dev`;
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

config(company, stage);

export interface MainStackProps extends StackProps {
  domainName: string;
  company: string;
  stage: string;
}

class MainStack extends Stack {
  readonly vpcStack: VpcStack;
  readonly route53Stack: Route53Stack;
  readonly acmStack: AcmStack;
  readonly wordpressStack: WordpressStack;

  constructor(scope: App, id: string, props: MainStackProps) {
    super(scope, id, props);

    console.log('prefixer', `${prefixer('acm-stack')}`);

    this.vpcStack = new VpcStack(this, `${prefixer('vpc-stack')}`, props);
    this.route53Stack = new Route53Stack(
      this,
      `${prefixer('route53-stack')}`,
      props
    );
    this.acmStack = new AcmStack(this, `${prefixer('acm-stack')}`, {
      ...props,
      hostedZone: this.route53Stack.hostedZone,
    });
    this.wordpressStack = new WordpressStack(
      this,
      `${prefixer('wordpress-stack')}`,
      {
        ...props,
        vpc: this.vpcStack.vpc,
        certificate: this.acmStack.certificate,
        hostedZone: this.route53Stack.hostedZone,
      }
    );
  }
}

new MainStack(app, `${prefixer('main-stack')}`, {
  env,
  domainName,
  company,
  stage,
});
