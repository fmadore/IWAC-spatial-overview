<!--
  Simple switch component for toggles in the spatial network sidebar
-->
<script lang="ts">
  let { 
    checked = false, 
    onCheckedChange,
    disabled = false,
    id = '',
    class: className = '',
    'aria-label': ariaLabel = 'Toggle switch'
  } = $props<{
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    id?: string;
    class?: string;
    'aria-label'?: string;
  }>();

  function handleClick() {
    if (disabled) return;
    
    const newChecked = !checked;
    if (onCheckedChange) {
      onCheckedChange(newChecked);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  {disabled}
  {id}
  class="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input {className}"
  data-state={checked ? 'checked' : 'unchecked'}
  onclick={handleClick}
  onkeydown={handleKeyDown}
>
  <span
    class="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
    data-state={checked ? 'checked' : 'unchecked'}
  ></span>
</button>
