import { Stack, App, StackProps } from 'aws-cdk-lib';
import { WordpressStack } from './wordpress-stack';

export class AppStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    // defines your stack here
    let worpressStack = new WordpressStack(scope, `ctt-wordpress-stack`, props);
  }
}
