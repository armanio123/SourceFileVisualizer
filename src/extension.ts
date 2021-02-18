import * as vscode from 'vscode';
import { getTreeConfig, TreeMode } from './transform';
import * as path from 'path';

interface PanelConfig {
	panel: vscode.WebviewPanel;
	treeMode: TreeMode;
	selections: ReadonlyArray<vscode.Selection> | undefined;
}

export function activate(context: vscode.ExtensionContext) {
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

	vscode.window.onDidChangeTextEditorSelection(e => {
		const panelConfig = panels.get(e.textEditor.document.uri);
		if (panelConfig) {
			panelConfig.selections = e.selections;

			panelRefresh(panelConfig, e.textEditor.document.uri, e.textEditor.document.getText());
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

	let command = vscode.commands.registerCommand('sourcefilevisualizer.visualizeTree', async () => {
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

		panel.webview.onDidReceiveMessage(async e => {
			switch (e.command) {
				case 'treeModeChange':
					panelConfig.treeMode = TreeMode[e.treeMode as keyof typeof TreeMode];
					panelRefresh(panelConfig, uri, document.getText());
					break;
				case 'nodeClick':
					// TODO: Implement on mouse click and mouse over.
					// const anchorLineCharacter = JSON.parse(e.anchorLineCharacterJson);
					// const activeLineCharacter = JSON.parse(e.anchorLineCharacterJson);
					// const anchorPosition = new vscode.Position(anchorLineCharacter.line, anchorLineCharacter.position);
					// const activePosition = new vscode.Position(activeLineCharacter.line, activeLineCharacter.position);
					break;
				case 'nodeMouseOver':
					break;
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
						debugger;
						vscode.postMessage({
							command: 'nodeClick',
							anchorLineCharacterJson: match.dataset.anchorlinecharacterjson,
							activeLineCharacterJson: match.dataset.activelinecharacterjson,
						});
					}
				}
			</script>
		</body>
	</html>`;
}