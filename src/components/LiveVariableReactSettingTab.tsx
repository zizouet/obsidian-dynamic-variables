import { FC, useEffect, useState } from "react";
import LiveVariable from "src/main";
import Setting from "./obsidian-components/Setting";

interface LiveVariableReactSettingTabProps {
	plugin: LiveVariable;
}

const LiveVariablesReactSettingTab: FC<LiveVariableReactSettingTabProps> = ({
	plugin,
}) => {
	const [highlightText, setHighlightText] = useState<boolean>(false);
	const [copyResolvedValues, setCopyResolvedValues] = useState<boolean>(true);

	useEffect(() => {
		void plugin.loadSettings().then(() => {
			setHighlightText(plugin.settings.highlightText);
			setCopyResolvedValues(plugin.settings.copyResolvedValues);
		});
	}, []);

	const updateHighlightText = (newValue: boolean) => {
		setHighlightText(newValue);
		plugin.settings.highlightText = newValue;
		void plugin.saveSettings();
	};

	const updateCopyResolvedValues = (newValue: boolean) => {
		setCopyResolvedValues(newValue);
		plugin.settings.copyResolvedValues = newValue;
		void plugin.saveSettings();
	};

	return (
		<div>
			<Setting heading name="Live Variables" />
			<Setting
				className="setting-item"
				name="Highlight live text"
				desc="Add highlighting style to inserted live variables."
				style={{ borderBottom: "0.5px solid var(--background-modifier-border)" }}
			>
				<Setting.Checkbox
					checked={highlightText}
					onChange={updateHighlightText}
				/>
			</Setting>
			<Setting
				className="setting-item"
				name="Copy resolved values"
				desc="When copying text from the editor, replace {{variables}} with their current value instead of the raw syntax."
				style={{ borderBottom: "0.5px solid var(--background-modifier-border)" }}
			>
				<Setting.Checkbox
					checked={copyResolvedValues}
					onChange={updateCopyResolvedValues}
				/>
			</Setting>
		</div>
	);
};

export default LiveVariablesReactSettingTab;
