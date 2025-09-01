<script lang="ts">
	import type { ProcessedItem } from '$lib/types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { ExternalLink, Calendar, MapPin, Newspaper, Search, SortAsc, SortDesc, Filter } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		articles: ProcessedItem[];
		entityName: string;
		maxVisible?: number;
	}

	let { articles, entityName, maxVisible = 10 }: Props = $props();

	// State for filtering and sorting
	let searchTerm = $state('');
	let sortBy = $state<'title' | 'date' | 'country' | 'newspaper'>('date');
	let sortOrder = $state<'asc' | 'desc'>('desc');
	let filterCountry = $state('');
	let filterNewspaper = $state('');
	let showFilters = $state(false);

	function getArticleUrl(articleId: string): string {
		// Extract the original article ID (remove coordinate index suffix)
		const originalId = articleId.split('-')[0];
		return `https://islam.zmo.de/s/westafrica/item/${originalId}`;
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get unique countries and newspapers for filter options
	const uniqueCountries = $derived([...new Set(articles.map(a => a.articleCountry).filter(Boolean))].sort());
	const uniqueNewspapers = $derived([...new Set(articles.map(a => a.newspaperSource).filter(Boolean))].sort());

	// Filtered and sorted articles
	const filteredAndSortedArticles = $derived.by(() => {
		let filtered = articles.filter(article => {
			const matchesSearch = !searchTerm || 
				article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
				article.newspaperSource.toLowerCase().includes(searchTerm.toLowerCase());
			
			const matchesCountry = !filterCountry || article.articleCountry === filterCountry;
			const matchesNewspaper = !filterNewspaper || article.newspaperSource === filterNewspaper;
			
			return matchesSearch && matchesCountry && matchesNewspaper;
		});

		// Remove duplicates by original article ID to avoid showing the same article multiple times
		const seenIds = new Set();
		filtered = filtered.filter(article => {
			const originalId = article.id.split('-')[0];
			if (seenIds.has(originalId)) return false;
			seenIds.add(originalId);
			return true;
		});

		// Sort articles
		filtered.sort((a, b) => {
			let comparison = 0;
			
			switch (sortBy) {
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'date':
					const dateA = a.publishDate?.getTime() || 0;
					const dateB = b.publishDate?.getTime() || 0;
					comparison = dateA - dateB;
					break;
				case 'country':
					comparison = a.articleCountry.localeCompare(b.articleCountry);
					break;
				case 'newspaper':
					comparison = a.newspaperSource.localeCompare(b.newspaperSource);
					break;
			}
			
			return sortOrder === 'asc' ? comparison : -comparison;
		});

		return filtered;
	});

	function toggleSort(field: typeof sortBy) {
		if (sortBy === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortOrder = 'asc';
		}
	}

	function clearFilters() {
		searchTerm = '';
		filterCountry = '';
		filterNewspaper = '';
	}
</script>

{#if articles.length > 0}
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Newspaper class="h-5 w-5" />
					Related Articles
					<span class="text-sm font-normal text-muted-foreground">({filteredAndSortedArticles.length})</span>
				</div>
				<Button variant="outline" size="sm" onclick={() => showFilters = !showFilters}>
					<Filter class="h-4 w-4" />
					Filters
				</Button>
			</CardTitle>
			
			{#if showFilters}
				<div class="space-y-4 pt-4 border-t">
					<!-- Search -->
					<div class="flex items-center gap-2">
						<Search class="h-4 w-4 text-muted-foreground" />
						<Input
							type="text"
							placeholder="Search articles..."
							bind:value={searchTerm}
							class="flex-1"
						/>
					</div>
					
					<!-- Filters and Sort -->
					<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
						<!-- Country Filter -->
						<div class="space-y-1">
							<label for="filter-country" class="text-xs font-medium text-muted-foreground">Country</label>
							<select id="filter-country" bind:value={filterCountry} class="w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
								<option value="">All countries</option>
								{#each uniqueCountries as country}
									<option value={country}>{country}</option>
								{/each}
							</select>
						</div>
						
						<!-- Newspaper Filter -->
						<div class="space-y-1">
							<label for="filter-newspaper" class="text-xs font-medium text-muted-foreground">Newspaper</label>
							<select id="filter-newspaper" bind:value={filterNewspaper} class="w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
								<option value="">All newspapers</option>
								{#each uniqueNewspapers as newspaper}
									<option value={newspaper}>{newspaper}</option>
								{/each}
							</select>
						</div>
						
						<!-- Sort By -->
						<div class="space-y-1">
							<label for="sort-by" class="text-xs font-medium text-muted-foreground">Sort by</label>
							<select id="sort-by" bind:value={sortBy} class="w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
								<option value="date">Date</option>
								<option value="title">Title</option>
								<option value="country">Country</option>
								<option value="newspaper">Newspaper</option>
							</select>
						</div>
						
						<!-- Sort Order -->
						<div class="space-y-1">
							<div class="text-xs font-medium text-muted-foreground">Order</div>
							<Button 
								variant="outline" 
								size="sm" 
								onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
								class="w-full justify-start"
								aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
							>
								{#if sortOrder === 'asc'}
									<SortAsc class="h-4 w-4 mr-2" />
									Ascending
								{:else}
									<SortDesc class="h-4 w-4 mr-2" />
									Descending
								{/if}
							</Button>
						</div>
					</div>
					
					<!-- Clear Filters -->
					{#if searchTerm || filterCountry || filterNewspaper}
						<Button variant="ghost" size="sm" onclick={clearFilters} class="w-fit">
							Clear all filters
						</Button>
					{/if}
				</div>
			{/if}
		</CardHeader>
		<CardContent>
			<div class="space-y-3">
				{#each filteredAndSortedArticles.slice(0, maxVisible) as article}
					<div class="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
						<div class="space-y-2">
							<!-- Title with external link -->
							<div class="flex items-start justify-between gap-2">
								<a
									href={getArticleUrl(article.id)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-base font-medium hover:text-primary transition-colors flex items-start gap-2 flex-1"
								>
									<span class="leading-tight overflow-hidden text-ellipsis"
										style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;"
									>
										{article.title}
									</span>
									<ExternalLink class="h-4 w-4 mt-0.5 flex-shrink-0 opacity-60" />
								</a>
							</div>
							
							<!-- Metadata -->
							<div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
								{#if article.publishDate}
									<div class="flex items-center gap-1">
										<Calendar class="h-3 w-3" />
										<span>{formatDate(article.publishDate)}</span>
									</div>
								{/if}
								
								{#if article.articleCountry}
									<div class="flex items-center gap-1">
										<MapPin class="h-3 w-3" />
										<span>{article.articleCountry}</span>
									</div>
								{/if}
								
								{#if article.newspaperSource}
									<div class="flex items-center gap-1">
										<Newspaper class="h-3 w-3" />
										<span>{article.newspaperSource}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
				
				{#if filteredAndSortedArticles.length > maxVisible}
					<div class="rounded-lg border border-dashed p-4 text-center">
						<span class="text-sm text-muted-foreground">
							... and {filteredAndSortedArticles.length - maxVisible} more articles
						</span>
					</div>
				{/if}
				
				{#if filteredAndSortedArticles.length === 0}
					<div class="rounded-lg border border-dashed p-8 text-center">
						<div class="text-muted-foreground">
							<Search class="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p class="text-sm">No articles found matching your filters.</p>
							{#if searchTerm || filterCountry || filterNewspaper}
								<Button variant="ghost" size="sm" onclick={clearFilters} class="mt-2">
									Clear filters
								</Button>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</CardContent>
	</Card>
{/if}
