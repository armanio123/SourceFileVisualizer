import type { SourceFile, Node } from 'typescript';
import * as vscode from 'vscode';

interface ChartStructure {
    text: {
        name: string;
        title: string;
        desc: string;
        'data-anchorLineCharacterJson': string;
        'data-activeLineCharacterJson': string;
    };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    HTMLclass: string;
    children: ChartStructure[];
}

async function getTS(): Promise<typeof import('typescript')> {
    const tsdk = vscode.workspace.getConfiguration("typescript").get("tsdk");

    if (typeof tsdk === "string") {
        return await import(`${tsdk}/typescript.js`);
    }

    // TODO: Handle the error gracefully or default a typescript version.
    // Preferably the current VSCode version.
    throw new Error(`Configuration error. tsdk value: "${tsdk}"`);
}

async function getChartStructure(sourceFile: SourceFile, node: Node, children: ChartStructure[], selections: ReadonlyArray<vscode.Selection> | undefined): Promise<ChartStructure> {
    let isSelected = false;
    const ts = await getTS();
    if (selections) {
        for (let selection of selections) {
            const start = ts.getLineAndCharacterOfPosition(sourceFile, node.pos);
            const end = ts.getLineAndCharacterOfPosition(sourceFile, node.end);

            const startPosition = new vscode.Position(start.line, start.character);
            const endPosition = new vscode.Position(end.line, end.character);

            const nodeRange = new vscode.Range(startPosition, endPosition);

            if (nodeRange.contains(selection)) {
                isSelected = true;
                break;
            }
        }
    }

    const anchorLineCharacter = ts.getLineAndCharacterOfPosition(sourceFile, node.pos);
    const activeLineCharacter = ts.getLineAndCharacterOfPosition(sourceFile, node.end);

    return {
        text: {
            // @ts-ignore
            name: ts.Debug.formatSyntaxKind(node.kind),
            title: `pos: ${node.pos}, end: ${node.end}`,
            desc: sourceFile.text.substring(node.pos, node.end).substr(0, 50).replace(/\n/g, '\\n'),
            'data-anchorLineCharacterJson': JSON.stringify(anchorLineCharacter),
            'data-activeLineCharacterJson': JSON.stringify(activeLineCharacter),

        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HTMLclass: isSelected ? 'selectedNode' : 'nodeItem',
        children,
    };
}

async function treeConfigGetChildren(sourceFile: SourceFile, node: Node, selections: ReadonlyArray<vscode.Selection> | undefined): Promise<ChartStructure> {
    let children: ChartStructure[] = [];

    for (let childNode of node.getChildren()) {
        children.push(await treeConfigGetChildren(sourceFile, childNode, selections));
    }

    return await getChartStructure(sourceFile, node, children, selections);
}

async function treeConfigForEachChild(sourceFile: SourceFile, node: Node, selections: ReadonlyArray<vscode.Selection> | undefined): Promise<ChartStructure> {
    let children: ChartStructure[] = [];
    const ts = await getTS();

    ts.forEachChild(node, async childNode => {
        children.push(await treeConfigForEachChild(sourceFile, childNode, selections));
    });

    return await getChartStructure(sourceFile, node, children, selections);
}

export async function getTreeConfig(uri: vscode.Uri, sourceText: string, treeMode: TreeMode, selections: ReadonlyArray<vscode.Selection> | undefined) {
    const ts = await getTS();

    const sourceFile = ts.createSourceFile(
        uri.path,
        sourceText,
        ts.ScriptTarget.ES2015,
        true
    );
    let result;
    switch (treeMode) {
        case TreeMode.forEachChild:
            result = await treeConfigForEachChild(sourceFile, sourceFile, selections);
            break;
        case TreeMode.getChildren:
            result = await treeConfigGetChildren(sourceFile, sourceFile, selections);
            break;
    }

    return JSON.stringify(result);
}

export enum TreeMode {
    forEachChild,
    getChildren,
};