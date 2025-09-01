<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

	interface Props {
		articles: ProcessedItem[];
		entityName: string;
		maxVisible?: number;
	}

	let { articles, entityName, maxVisible = 10 }: Props = $props();
</script>

{#if articles.length > 0}
	<Card>
		<CardHeader>
			<CardTitle>Related Articles ({articles.length})</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="text-muted-foreground">
						<tr>
							<th class="px-2 py-1 text-left">Title</th>
							<th class="px-2 py-1 text-left">Date</th>
							<th class="px-2 py-1 text-left">Country</th>
							<th class="px-2 py-1 text-left">Newspaper</th>
						</tr>
					</thead>
					<tbody>
						{#each articles.slice(0, maxVisible) as article}
							<tr class="border-t">
								<td class="px-2 py-1 max-w-xs truncate">{article.title}</td>
								<td class="px-2 py-1">{article.publishDate?.toISOString?.().slice(0, 10) || ''}</td>
								<td class="px-2 py-1">{article.country}</td>
								<td class="px-2 py-1">{article.newspaperSource}</td>
							</tr>
						{/each}
						{#if articles.length > maxVisible}
							<tr class="border-t">
								<td colspan="4" class="px-2 py-1 text-center text-muted-foreground">
									... and {articles.length - maxVisible} more articles
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</CardContent>
	</Card>
{/if}
