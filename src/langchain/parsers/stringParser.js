import { StringOutputParser } from "@langchain/core/output_parsers";

export function createStringParser() {
  return new StringOutputParser();
}
