<script lang="ts">
	// Shows one of the repo's legal Markdown files (TERMS.md, PRIVACY.md)
	// in the app, so the store listing's URL and the app say the same
	// thing. Only what those files use: ## headings, paragraphs, "- "
	// lists and **bold**; the "# " title is the page's own.
	let { text }: { text: string } = $props();

	type Block = { kind: 'h' | 'p'; text: string } | { kind: 'ul'; items: string[] };
	const blocks = $derived.by(() => {
		const out: Block[] = [];
		for (const chunk of text.split(/\n\s*\n/)) {
			const lines = chunk.trim().split('\n');
			if (!lines[0] || lines[0].startsWith('# ')) continue;
			if (lines[0].startsWith('## ')) out.push({ kind: 'h', text: lines[0].slice(3) });
			else if (lines.every((l) => l.startsWith('- '))) out.push({ kind: 'ul', items: lines.map((l) => l.slice(2)) });
			else out.push({ kind: 'p', text: lines.join(' ') });
		}
		return out;
	});
	/** Text split into plain and **bold** runs. */
	const runs = (s: string) => s.split(/\*\*(.+?)\*\*/).map((t, i) => ({ t, b: i % 2 === 1 }));
</script>

{#snippet inline(s: string)}{#each runs(s) as r, i (i)}{#if r.b}<strong>{r.t}</strong>{:else}{r.t}{/if}{/each}{/snippet}

<div class="card legal">
	{#each blocks as b, i (i)}
		{#if b.kind === 'h'}
			<h2>{b.text}</h2>
		{:else if b.kind === 'ul'}
			<ul>
				{#each b.items as it, j (j)}<li>{@render inline(it)}</li>{/each}
			</ul>
		{:else}
			<p>{@render inline(b.text)}</p>
		{/if}
	{/each}
</div>

<style>
	.legal {
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--muted);
		user-select: text;
		-webkit-user-select: text;
	}
	h2 {
		font-size: 1rem;
		color: var(--text);
		margin: 16px 0 6px;
	}
	h2:first-child {
		margin-top: 0;
	}
	p {
		margin: 0 0 8px;
	}
	ul {
		margin: 0 0 8px;
		padding-left: 20px;
	}
	li {
		margin-bottom: 4px;
	}
	strong {
		color: var(--text);
	}
</style>
