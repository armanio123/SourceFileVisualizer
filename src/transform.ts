// TODO: Configure typescript location or use vscode tsdk.
import * as ts from '/Repos/TypeScript-GH/built/local/typescript';
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

function getChartStructure(sourceFile: ts.SourceFile, node: ts.Node, children: ChartStructure[], selections: ReadonlyArray<vscode.Selection> | undefined): ChartStructure {
    let isSelected = false;
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

function treeConfigGetChildren(sourceFile: ts.SourceFile, node: ts.Node, selections: ReadonlyArray<vscode.Selection> | undefined): ChartStructure {
    let children: ChartStructure[] = [];

    for (let childNode of node.getChildren()) {
        children.push(treeConfigGetChildren(sourceFile, childNode, selections));
    }

    return getChartStructure(sourceFile, node, children, selections);
}

function treeConfigForEachChild(sourceFile: ts.SourceFile, node: ts.Node, selections: ReadonlyArray<vscode.Selection> | undefined): ChartStructure {
    let children: ChartStructure[] = [];

    ts.forEachChild(node, childNode => {
        children.push(treeConfigForEachChild(sourceFile, childNode, selections));
    });

    return getChartStructure(sourceFile, node, children, selections);
}

export async function getTreeConfig(uri: vscode.Uri, sourceText: string, treeMode: TreeMode, selections: ReadonlyArray<vscode.Selection> | undefined) {
    const sourceFile = ts.createSourceFile(
        uri.path,
        sourceText,
        ts.ScriptTarget.ES2015,
        true
    );
    let result;
    switch (treeMode) {
        case TreeMode.forEachChild:
            result = treeConfigForEachChild(sourceFile, sourceFile, selections);
            break;
        case TreeMode.getChildren:
            result = treeConfigGetChildren(sourceFile, sourceFile, selections);
            break;
    }

    return JSON.stringify(result);
}

export enum TreeMode {
    forEachChild,
    getChildren,
};