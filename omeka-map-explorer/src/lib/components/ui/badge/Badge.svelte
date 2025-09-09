<script lang="ts">
	import { cn } from '$lib/utils.js';

	type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

	export let variant: BadgeVariant = 'default';

	type $$Props = {
		variant?: BadgeVariant;
		class?: string;
	};

	let className = '';
	export { className as class };

	function getBadgeClasses(variant: BadgeVariant): string {
		const baseClasses = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
		
		switch (variant) {
			case 'secondary':
				return `${baseClasses} border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80`;
			case 'destructive':
				return `${baseClasses} border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80`;
			case 'outline':
				return `${baseClasses} text-foreground`;
			default:
				return `${baseClasses} border-transparent bg-primary text-primary-foreground hover:bg-primary/80`;
		}
	}
</script>

<div class={cn(getBadgeClasses(variant), className)} {...$$restProps}>
	<slot />
</div>
