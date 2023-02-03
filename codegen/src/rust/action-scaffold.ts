import * as model from "../deps/core/model.ts";
import { ActionKind } from "./utils/mod.ts";

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(context: Context): void {
    let variant;
    if (context.config.variant === undefined) {
      variant === ActionKind.RequestResponse;
    } else {
      variant === context.config.variant;
    }
    this.write(`
    use crate::actions::${context.config.interface}_service::${context.config.action}::*;

    `);
    if (context.config.variant === ActionKind.RequestChannel) {
      this.write(`
      pub(crate) async fn task(mut input:Inputs) -> Result<Outputs, crate::Error> {
        todo!("Add implementation");
      }`);
    } else if (context.config.variant === ActionKind.RequestStream) {
      this.write(`
      pub(crate) async fn task(input: Inputs) -> Result<Outputs, crate::Error> {
        todo!("Add implementation");
      }`);
    } else {
      this.write(`
      pub(crate) async fn task(input: Inputs) -> Result<Outputs, crate::Error> {
        todo!("Add implementation");
      }`);
    }
  }
}
