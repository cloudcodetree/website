export class Utils {
  static company: string;
  static stage: string;

  static config(company: string, stage: string) {
    Utils.company = company;
    Utils.stage = stage;
  }

  static prefixer(stack: string): string {
    return `${Utils.company}-${Utils.stage}-${stack}`;
  }
}

export const prefixer = (stack: string): string => {
  return Utils.prefixer(stack);
};

export const config = (company: string, stage: string) => {
  Utils.config(company, stage);
};
