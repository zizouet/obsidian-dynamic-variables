import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	prepareFuzzySearch,
	renderResults,
	SearchResult,
	TFile,
} from "obsidian";
import LiveVariables from "../main";
import { trancateString } from "../utils";
import { Properties } from "../VaultProperties";

export interface Property {
	// Full reference inserted into the document, e.g. "Notes/Budget.md.rate".
	key: string;
	// Leaf property name shown prominently and matched against first ("rate").
	name: string;
	// De-emphasized path reference shown to the side ("Notes/Budget.md").
	path: string;
	value: string;
	// Fuzzy match on the name, used to highlight matched characters.
	match?: SearchResult;
}

// Splits a full key into its leaf variable name and the preceding path. The last
// "." or "/" separates the name from the path (folder/file/nested-property chain).
const splitKey = (key: string): { name: string; path: string } => {
	const sep = Math.max(key.lastIndexOf("."), key.lastIndexOf("/"));
	if (sep === -1) {
		return { name: key, path: "" };
	}
	return { name: key.slice(sep + 1), path: key.slice(0, sep) };
};

// Matches an open, not-yet-closed {{ token from the start of the line up to the
// cursor, capturing the partial variable name typed so far.
const TRIGGER_RE = /\{\{([^{}]*)$/;

// A key is a usable variable only if it resolves to an actual leaf value. Folder
// and file path segments (and empty files) resolve to plain objects / {} — we
// skip those so the suggestion list isn't cluttered with valueless entries.
const hasVariableValue = (value: Properties): boolean => {
	if (value === undefined || value === null) {
		return false;
	}
	if (typeof value === "object" && !Array.isArray(value)) {
		return false;
	}
	return true;
};

export class VariableSuggest extends EditorSuggest<Property> {
	plugin: LiveVariables;

	constructor(plugin: LiveVariables) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile
	): EditorSuggestTriggerInfo | null {
		const lineUpToCursor = editor
			.getLine(cursor.line)
			.substring(0, cursor.ch);
		const match = TRIGGER_RE.exec(lineUpToCursor);
		if (!match) {
			return null;
		}
		return {
			start: { line: cursor.line, ch: cursor.ch - match[0].length },
			end: cursor,
			query: match[1],
		};
	}

	getSuggestions(context: EditorSuggestContext): Property[] {
		const vaultProperties = this.plugin.vaultProperties;
		const candidates = vaultProperties
			.getLocalKeysAndAllVariableKeys()
			.filter((key) => hasVariableValue(vaultProperties.getProperty(key)))
			.map((key) => ({
				key,
				...splitKey(key),
				value: vaultProperties.getPropertyPreview(key),
			}));

		const query = context.query.trim();
		if (query.length === 0) {
			return candidates;
		}

		// Match the variable name first; fall back to the path so cross-vault
		// references stay reachable, but always rank name matches ahead of them.
		const fuzzy = prepareFuzzySearch(query);
		return candidates
			.map((candidate) => {
				const nameResult = fuzzy(candidate.name);
				const pathResult = fuzzy(candidate.path);
				return {
					...candidate,
					match: nameResult ?? undefined,
					nameResult,
					pathResult,
				};
			})
			.filter((c) => c.nameResult !== null || c.pathResult !== null)
			.sort((a, b) => {
				const aRank: [number, number] = a.nameResult
					? [0, -a.nameResult.score]
					: [1, -(a.pathResult?.score ?? 0)];
				const bRank: [number, number] = b.nameResult
					? [0, -b.nameResult.score]
					: [1, -(b.pathResult?.score ?? 0)];
				return aRank[0] - bRank[0] || aRank[1] - bRank[1];
			})
			.map(({ key, name, path, value, match }) => ({
				key,
				name,
				path,
				value,
				match,
			}));
	}

	renderSuggestion(property: Property, el: HTMLElement): void {
		const title = el.createDiv({ cls: "lv-suggest-title" });
		const nameEl = title.createSpan({ cls: "lv-suggest-name" });
		if (property.match) {
			renderResults(nameEl, property.name, property.match);
		} else {
			nameEl.setText(property.name);
		}
		if (property.path) {
			title.createSpan({
				cls: "lv-suggest-path",
				text: property.path,
			});
		}
		el.createEl("small", {
			text: trancateString(property.value, 100),
		});
	}

	selectSuggestion(property: Property): void {
		if (!this.context) {
			return;
		}
		const { editor, start, end } = this.context;
		// Obsidian's bracket auto-close may already have inserted the closing
		// braces; consume up to two trailing "}" after the cursor so we don't
		// end up with "{{name}}}}".
		const trailing = editor
			.getLine(end.line)
			.slice(end.ch)
			.match(/^\}{1,2}/);
		const replaceEnd: EditorPosition = trailing
			? { line: end.line, ch: end.ch + trailing[0].length }
			: end;
		const insert = `{{${property.key}}}`;
		editor.replaceRange(insert, start, replaceEnd);
		editor.setCursor({
			line: start.line,
			ch: start.ch + insert.length,
		});
		this.close();
	}
}
