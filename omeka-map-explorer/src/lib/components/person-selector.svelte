<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Check, ChevronsUpDown } from "lucide-svelte";
  import { cn } from "$lib/utils";
  import { appState } from "$lib/state/appState.svelte";

  type Person = {
    id: string;
    name: string;
    relatedArticleIds: string[];
  };

  interface Props {
    persons?: Person[];
    selectedPersonId?: string | null;
  }

  let { persons = [], selectedPersonId = null }: Props = $props();

  let open = $state(false);
  let searchValue = $state("");

  const selectedPerson = $derived.by(() => 
    persons.find(p => p.id === selectedPersonId)
  );

  const filteredPersons = $derived.by(() => {
    if (!searchValue) return persons;
    return persons.filter(person =>
      person.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  });

  function selectPerson(person: Person) {
    selectedPersonId = person.id;
    open = false;
    searchValue = "";
    
    // Update app state with selected person
    appState.selectedEntity = {
      type: 'Personnes',
      id: person.id,
      name: person.name,
      relatedArticleIds: person.relatedArticleIds
    };
  }

  function clearSelection() {
    selectedPersonId = null;
    appState.selectedEntity = null;
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    <span class="text-sm font-medium">Select Person</span>
    {#if selectedPersonId}
      <Button
        variant="ghost"
        size="sm"
        onclick={clearSelection}
        class="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </Button>
    {/if}
  </div>

  <Popover.Root bind:open>
    <Popover.Trigger>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        class="w-full justify-between"
      >
        {selectedPerson ? selectedPerson.name : "Select person..."}
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[400px] p-0">
      <Command.Root>
        <Command.Input 
          placeholder="Search persons..." 
          bind:value={searchValue}
        />
        <Command.Empty>No person found.</Command.Empty>
        <Command.Group class="max-h-64 overflow-auto">
          {#each filteredPersons as person (person.id)}
            <Command.Item
              value={person.name}
              onSelect={() => selectPerson(person)}
              class="flex items-center justify-between"
            >
              <div class="flex flex-col">
                <span>{person.name}</span>
                <span class="text-xs text-muted-foreground">
                  {person.relatedArticleIds.length} article{person.relatedArticleIds.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Check
                class={cn(
                  "ml-auto h-4 w-4",
                  selectedPersonId === person.id ? "opacity-100" : "opacity-0"
                )}
              />
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>

  {#if selectedPerson}
    <div class="text-sm text-muted-foreground">
      Showing locations from {selectedPerson.relatedArticleIds.length} related articles
    </div>
  {/if}
</div>
