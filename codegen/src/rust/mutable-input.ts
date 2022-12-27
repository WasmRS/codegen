import { Input, SyntaxNode } from "./deps/lezer.ts";

export class MutableInput implements Input {
  original: string;
  current = "";
  pos = 0;
  chunkSize = 10;
  lineChunks = false;

  constructor(source: string) {
    this.original = source;
    this.current = source;
  }
  get length(): number {
    return this.current.length;
  }
  chunk(from: number): string {
    const to =
      this.current.length > this.pos + this.chunkSize
        ? this.length
        : this.pos + this.chunkSize;
    const chunk = this.current.substring(this.pos, to);
    this.pos = to;
    return chunk;
  }
  read(from: number, to: number): string {
    return this.current.substring(from, to);
  }
  update(src: string, node: SyntaxNode) {
    const len = src.length;
    // console.log(src);
    // console.log({ pos: this.pos });
    // console.log(node);
    if (this.pos <= node.from) {
      const start = this.current.substring(0, node.from);
      const end = this.current.substring(node.to);
      this.current = start + src + end;
    } else {
      const oldLen = node.to - node.from;
      const start = this.current.substring(0, node.from);
      const end = this.current.substring(node.to);
      this.current = start + src + end;
      this.pos += len - oldLen;
    }
  }
  toString(): string {
    return this.current;
  }
}
