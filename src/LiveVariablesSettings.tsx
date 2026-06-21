import { App, PluginSettingTab } from "obsidian";
import LiveVariable from "./main";
import { createRoot, Root } from "react-dom/client";
import LiveVariablesReactSettingTab from "./components/LiveVariableReactSettingTab";

export interface LiveVariablesSettings {
	highlightText: boolean;
	copyResolvedValues: boolean;
}

export const DEFAULT_SETTINGS: LiveVariablesSettings = {
	highlightText: false,
	copyResolvedValues: true,
};

export class LiveVariablesSettingTab extends PluginSettingTab {
	plugin: LiveVariable;
	root: Root | null;

	constructor(app: App, plugin: LiveVariable) {
		super(app, plugin);
		this.plugin = plugin;
		this.root = createRoot(this.containerEl);
	}

	display(): void {
		this.renderReactSettingTab();
	}

	renderReactSettingTab() {
		this.root?.render(
			<LiveVariablesReactSettingTab plugin={this.plugin} />
		);
	}
}
