import * as model from './deps/apex_model.ts';

type Context = model.Context;

export default class DefaultVisitor extends model.BaseVisitor {
  visitContextAfter(context: Context): void {
    this.write(`
#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Just an example")]
    ExampleError,
}
    `);
  }
}
