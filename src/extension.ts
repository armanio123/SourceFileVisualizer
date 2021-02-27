import * as vscode from 'vscode';
import { getTreeConfig, TreeMode } from './transform';
import * as path from 'path';

enum Commands {
	treeModeChange = 'treeModeChange',
	nodeMouseEnter = 'nodeMouseEnter',
	nodeClick = 'nodeClick',
	nodeMouseLeave = 'nodeMouseLeave'
}

interface PanelConfig {
	panel: vscode.WebviewPanel;
	treeMode: TreeMode;
	selections: ReadonlyArray<vscode.Selection> | undefined;
}

interface Message {
	command: Commands;
	treeMode?: TreeMode;
	anchorLineCharacterJson?: string;
	activeLineCharacterJson?: string;
}

export function activate(context: vscode.ExtensionContext) {
	// TODO: Use vscodes themes
	var mouseOverDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: '#613214',
	});

	const panels: Map<vscode.Uri, PanelConfig> = new Map<vscode.Uri, PanelConfig>();

	const treantJs = vscode.Uri.file(path.join(context.extensionPath, 'treant-js-master', 'Treant.js'));
	const treantCss = vscode.Uri.file(path.join(context.extensionPath, 'treant-js-master', 'Treant.css'));
	const raphaelJs = vscode.Uri.file(path.join(context.extensionPath, 'treant-js-master/vendor', 'raphael.js'));

	// Register when any of the documents change.
	vscode.workspace.onDidChangeTextDocument(async e => {
		const panelConfig = panels.get(e.document.uri);
		if (panelConfig) {
			panelRefresh(panelConfig, e.document.uri, e.document.getText());
		}
	});

	// TOOD: Dont refresh the whole html, instead just message the new selection. Is probably a performance improvement.
	vscode.window.onDidChangeTextEditorSelection(e => {
		const panelConfig = panels.get(e.textEditor.document.uri);
		if (panelConfig) {
			if (panelConfig.selections && !panelConfig.selections[0].isEqual(e.selections[0])) {
				// Update and refresh.
				panelConfig.selections = e.selections;
				panelRefresh(panelConfig, e.textEditor.document.uri, e.textEditor.document.getText());
			}
			else {
				panelConfig.selections = e.selections;
			}
		}
	});

	async function panelRefresh(panelConfig: PanelConfig, uri: vscode.Uri, sourceText: string) {
		const treeConfig = await getTreeConfig(uri, sourceText, panelConfig.treeMode, panelConfig.selections);

		panelConfig.panel.webview.html = getWebviewContent(
			treeConfig,
			panelConfig.panel.webview.asWebviewUri(treantCss),
			panelConfig.panel.webview.asWebviewUri(treantJs),
			panelConfig.panel.webview.asWebviewUri(raphaelJs),
			panelConfig.treeMode
		);
	}

	const command = vscode.commands.registerCommand('sourcefilevisualizer.visualizeTree', async () => {
		const document = vscode.window.activeTextEditor?.document;
		const uri = document?.uri;
		if (!document || !uri) {
			return;
		}

		const selections = vscode.window.activeTextEditor?.selections;
		const treeMode = TreeMode.getChildren;

		const treeConfig = await getTreeConfig(uri, document.getText(), treeMode, selections);

		const panel = vscode.window.createWebviewPanel(
			'astViewer',
			`AST: ${uri.path}`,
			vscode.ViewColumn.Beside,
			{
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'treant-js-master'))],
				enableScripts: true,
			}
		);

		panel.webview.html = getWebviewContent(
			treeConfig,
			panel.webview.asWebviewUri(treantCss),
			panel.webview.asWebviewUri(treantJs),
			panel.webview.asWebviewUri(raphaelJs),
			treeMode
		);

		panel.onDidDispose(() => {
			panels.delete(uri);
		});

		panel.webview.onDidReceiveMessage(async (e: Message) => {
			const { anchor, active } = getPositions(e);
			const textEditor = getTextEditor();
			switch (e.command) {
				case Commands.treeModeChange:
					panelConfig.treeMode = e.treeMode!;
					panelRefresh(panelConfig, uri, document.getText());
					break;
				case Commands.nodeClick:
					textEditor.revealRange(new vscode.Range(anchor!, active!));
					textEditor.selection = new vscode.Selection(anchor!, active!);
					break;
				case Commands.nodeMouseEnter:
					textEditor.setDecorations(mouseOverDecoration, [new vscode.Range(anchor!, active!)]);
					break;
				case Commands.nodeMouseLeave:
					textEditor.setDecorations(mouseOverDecoration, []);
					break;
			}

			function getTextEditor(): vscode.TextEditor {
				for (const textEditor of vscode.window.visibleTextEditors) {
					if (textEditor.document === document) {
						return textEditor;
					}
				}

				throw new Error('textEditor not found');
			}
		});

		const panelConfig: PanelConfig = {
			panel,
			treeMode,
			selections,
		};

		panels.set(uri, panelConfig);
	});

	context.subscriptions.push(command);
}

export function deactivate() { }

function getPositions(message: Message): { anchor?: vscode.Position, active?: vscode.Position } {
	if (!message.anchorLineCharacterJson || !message.activeLineCharacterJson) {
		return {};
	}

	const anchorLineCharacter = JSON.parse(message.anchorLineCharacterJson!);
	const activeLineCharacter = JSON.parse(message.activeLineCharacterJson!);

	return {
		anchor: new vscode.Position(anchorLineCharacter.line, anchorLineCharacter.character),
		active: new vscode.Position(activeLineCharacter.line, activeLineCharacter.character)
	};
}

// TODO: Remove execution of docSrc. I think this is a security flaw.
// TOOD: Move html to it's own file. Dev debt.
// TODO: Use vscode's theme in colors and fonts.
function getWebviewContent(docSrc: string, treantCssSrc: vscode.Uri, treantJsSrc: vscode.Uri, raphaelJsSrc: vscode.Uri, treeMode: TreeMode) {
	return `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Cat Coding</title>
			<link rel="stylesheet" href="${treantCssSrc}" type="text/css" />
		</head>
		<body>
			<div>
				<select onchange="treeModeChange(this[this.selectedIndex].value)">
					<option ${treeMode === TreeMode.forEachChild ? 'selected' : ''}>forEachChild</option>
					<option ${treeMode === TreeMode.getChildren ? 'selected' : ''}>getChildren</option>
				</select>
			</div>
			<div id="tree"></div>

			<script src="${raphaelJsSrc}"></script>
			<script src="${treantJsSrc}"></script>
			<style type="text/css">
				.nodeItem {
					border: 1px solid #D4D4D4;
					padding: 10px;
				}
				.selectedNode {
					border: 1px solid #CBCB41;
					padding: 10px;
				}
			</style>

			<script>
				// Configure chart
				var nodeStructure = ${docSrc};
				let treeConfig = {
					chart: {
						container: "#tree",
						connectors: {
							type: "step",
							style: {
								stroke: "#D4D4D4",
							},
						},
					},
					nodeStructure
				};

				var chart = new Treant(treeConfig);

				// Setup vscode post messages.
				const vscode = acquireVsCodeApi();

				function treeModeChange(value) {
					vscode.postMessage({
						command: 'treeModeChange',
						treeMode: value
					});
				}
				
				var matches = document
					.querySelector('#tree')
					.querySelectorAll('div.node');

				for(let match of matches) {
					match.onclick = function() {
						vscode.postMessage({
							command: 'nodeClick',
							anchorLineCharacterJson: match.dataset.anchorlinecharacterjson,
							activeLineCharacterJson: match.dataset.activelinecharacterjson,
						});
					}
					match.onmouseenter = function() {
						vscode.postMessage({
							command: 'nodeMouseEnter',
							anchorLineCharacterJson: match.dataset.anchorlinecharacterjson,
							activeLineCharacterJson: match.dataset.activelinecharacterjson,
						});
					}
					match.onmouseleave = function() {
						vscode.postMessage({
							command: 'nodeMouseLeave'
						});
					}
				}
			</script>
		</body>
	</html>`;
}