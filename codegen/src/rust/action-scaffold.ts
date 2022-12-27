import * as model from "./deps/apex_model.ts";

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(context: Context): void {
    this.write(`
use crate::actions::${context.config.interface}_service::${context.config.action}::*;

pub(crate) async fn task(input: Inputs) -> Result<Outputs, crate::Error> {
  todo!("Add implementation");
}

    `);
  }
}
