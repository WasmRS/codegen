import * as model from "../deps/core/model.ts";

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(context: Context): void {
    context.config.modules.forEach((module: string) => {
      this.write(`
      pub(crate) mod ${module};
      `);
    });
  }
}
