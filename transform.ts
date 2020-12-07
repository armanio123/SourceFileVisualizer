import * as ts from "typescript";
import { readFileSync, writeFileSync } from "fs";

const sourceFilePath = "./sourceFile.ts";
const pos = -1;

function treeConfig(sourceText: string, node: ts.Node) {
    let children: any = [];

    for (let childNode of node.getChildren()) {
        children.push(treeConfig(sourceText, childNode));
    }

    return {
        text: {
            // @ts-ignore
            name: ts.Debug.formatSyntaxKind(node.kind),
            title: `pos: ${node.pos}, end: ${node.end}`,
            desc: sourceText.substring(node.pos, node.end).substr(0, 50)
        },
        HTMLclass: pos < node.pos || pos > node.end ? 'nodeItem' : 'strongNode',
        children,
    };
}

const sourceFile = ts.createSourceFile(
    sourceFilePath,
    readFileSync(sourceFilePath).toString(),
    ts.ScriptTarget.ES2015,
    true
);

const result = treeConfig(sourceFile.text, sourceFile);
writeFileSync("./nodeStructure.js", `const nodeStructure = ${JSON.stringify(result)};`)