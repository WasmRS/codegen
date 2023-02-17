type Lines = string | string[];

export function Fn(name: string): string & Fn {
  return Object.assign(`fn ${name}`, { Args: _args });
}

export function If(expr: string): string & If {
  const src = `if ${expr}`;
  return Object.assign(src, { Then: _then });
}

export function Let(ids: Lines): string & Let {
  let src;
  if (Array.isArray(ids)) {
    src = `let (${j(ids, ",")}) = `;
  } else {
    src = `let ${ids} = `;
  }
  return Object.assign(src, { Equal: _equal });
}

export function Call(expr: string): string & Call {
  const src = `${expr}()`;
  return Object.assign(src, { With: _with });
}

export function IgnoreReturn(expr: string): string {
  return `let _ = ${expr}`;
}

export function While(expr: string): string & While {
  const src = `while ${expr}`;
  return Object.assign(src, { Do: _do });
}

export function Match(expr: string): string & Match {
  const src = `match ${expr}`;
  return Object.assign(src, {
    Cases: _cases,
    Error: (stmts: Lines): string => _cases.call(src, { err: stmts }),
  });
}

export function Spawn(statements: Lines): string {
  return `spawn(async move ${_block(statements)});`;
}

function _then(this: string, statements: Lines): string & Then {
  const src = `${this}${_block(statements)}`;
  return Object.assign(src, { Else: _else });
}

function _else(this: string, statements: Lines): string {
  return `${this}else${_block(statements)}`;
}

function _args(this: string, args: Lines): string & Args {
  const src = `${this}(${j(args, ",")})`;
  return Object.assign(src, { Type: _type });
}

function _type(this: string, type: string): string & Type {
  const src = `${this}->${type}`;
  return Object.assign(src, { Body: _body });
}

function _body(this: string, statements: Lines): string {
  return `${this}${_block(statements)}`;
}

function _with(this: string, args: Lines): string {
  // This removes the trailing `()` appended by the `Call` function.
  const callee = this.substring(0, this.length - 2);
  return `${callee}(${j(args, ",")})`;
}

function _cases(this: string, cases: Record<string, Lines>): string {
  if (Object.keys(cases).length === 1 && "err" in cases) {
    return `${this} {
      Ok(o)=> o,
      Err(e)=> ${_block(cases.err)},
    }`;
  } else {
    return `${this} { ${
      j(Object.entries(cases).map(([k, v]) => `${k} => ${_block(v)},`))
    } }`;
  }
}

function _do(this: string, statements: Lines): string {
  return `${this}${_block(statements)}`;
}

function _equal(this: string, expr: Lines): string {
  if (Array.isArray(expr)) {
    return `${this}(${j(expr, ",")})`;
  } else {
    return `${this}${expr}`;
  }
}

function _block(statements: Lines): string {
  if (!Array.isArray(statements)) {
    statements = [statements];
  }
  return `{${j(statements, "\n")}}`;
}

interface Then {
  Else(expr: Lines): string;
}

interface Fn {
  Args(params: Lines): string & Args;
}

interface Args {
  Type(type: string): string & Type;
}

interface Type {
  Body(body: Lines): string;
}

interface Call {
  With(params: Lines): string;
}

interface If {
  Then(stmts: Lines): string & Then;
}

interface Let {
  Equal(expr: string): string;
}
interface Match {
  Cases(cases: Record<string, Lines>): string;
  Error(errCase: Lines): string;
}

interface While {
  Do(stmts: Lines): string;
}

function j(lines: Lines, separator = "\n"): string {
  const block = Array.isArray(lines) ? lines.join(separator) : lines;
  const openParens = block.match(/\(/g) || [];
  const openCurlies = block.match(/\{/g) || [];
  const closeParens = block.match(/\)/g) || [];
  const closeCurlies = block.match(/\}/g) || [];
  if (
    openParens.length !== closeParens.length ||
    openCurlies.length !== closeCurlies.length
  ) {
    console.error(lines);
  }

  return block;
}
