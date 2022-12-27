import { path } from "./deps/std.ts";

const __dirname = new URL(".", import.meta.url).pathname;

export function getTemplate(
  template: string,
  context?: Record<string, any>
): string {
  const src = Deno.readTextFileSync(
    path.join(__dirname, "rs", `${template}.rs`)
  );
  if (context) {
    return parseTemplateExpression(src, context);
  }
  return src;
}

export function parseTemplateExpression(
  expr: string,
  context: Record<string, any>
): string {
  return expr.replace(/\$\{(.*?)\}/g, (m, args) => {
    return context[args];
  });
}
