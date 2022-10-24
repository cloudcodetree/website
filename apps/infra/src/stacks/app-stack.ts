import { Stack, App, StackProps } from 'aws-cdk-lib';
import { WordpressStack } from './wordpress-stack';

export interface AppStackProps extends StackProps {
  domainName: string;
  prefix: string;
}

export class AppStack extends Stack {
  constructor(scope: App, id: string, props: AppStackProps) {
    super(scope, id, props);

    // defines your stack here
    new WordpressStack(scope, `cct-wordpress-stack`, props);
  }
}
