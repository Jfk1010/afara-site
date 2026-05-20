<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { ComponentType, SvelteComponent } from 'svelte'

  type Hit = Record<string, unknown> & {
    objectID?: string
    _highlightResult?: Record<string, { value?: string }>
    _snippetResult?: Record<string, { value?: string }>
  }

  type SearchResult = {
    hits?: Hit[]
  }

  export let indices: Record<string, ComponentType<SvelteComponent<{ hit: Hit }>>>
  export let appId = ''
  export let searchKey = ''
  export let loadingMsg = 'Searching...'
  export let noResultMsg: (query: string) => string = (query) => `No results for ${query}`
  export let resultCounter: (hits: Hit[]) => string = (hits) => `${hits.length}`
  export let placeholder = 'Search'
  export let ariaLabel = 'Search'

  const dispatch = createEventDispatcher()

  let query = ''
  let loading = false
  let open = false
  let results: { index: string; component: ComponentType; hit: Hit }[] = []
  let searchToken = 0

  $: hasConfig = Boolean(appId && searchKey)
  $: hasQuery = query.trim().length > 1

  function close() {
    open = false
    dispatch('close')
  }

  function formatHit(hit: Hit) {
    const formatted = { ...hit }
    const highlight = hit._highlightResult || {}
    const snippets = hit._snippetResult || {}

    for (const [key, value] of Object.entries({ ...highlight, ...snippets })) {
      if (value?.value) formatted[key] = value.value
    }

    return formatted
  }

  async function search() {
    const trimmedQuery = query.trim()
    const token = ++searchToken

    if (!hasConfig || trimmedQuery.length < 2) {
      results = []
      loading = false
      return
    }

    loading = true
    open = true

    const requests = Object.keys(indices).map((indexName) => ({
      indexName,
      params: new URLSearchParams({
        query: trimmedQuery,
        hitsPerPage: '5',
      }).toString(),
    }))

    try {
      const response = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/*/queries`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-algolia-api-key': searchKey,
          'x-algolia-application-id': appId,
        },
        body: JSON.stringify({ requests }),
      })

      if (!response.ok) throw new Error(`Algolia search failed: ${response.status}`)

      const data = (await response.json()) as { results?: SearchResult[] }
      if (token !== searchToken) return

      results = (data.results || []).flatMap((result, index) => {
        const indexName = requests[index].indexName
        const component = indices[indexName]
        return (result.hits || []).map((hit) => ({
          index: indexName,
          component,
          hit: formatHit(hit),
        }))
      })
    } catch {
      if (token === searchToken) results = []
    } finally {
      if (token === searchToken) loading = false
    }
  }

  $: void search()
</script>

<div class="search" class:open>
  <input
    bind:value={query}
    on:focus={() => (open = hasQuery)}
    {placeholder}
    aria-label={ariaLabel}
    autocomplete="off"
  />

  {#if open && hasQuery}
    <div class="panel">
      {#if loading}
        <p>{loadingMsg}</p>
      {:else if results.length}
        <p>{@html resultCounter(results.map((result) => result.hit))}</p>
        {#each results as result (result.hit.objectID || `${result.index}-${JSON.stringify(result.hit)}`)}
          <svelte:component this={result.component} hit={result.hit} on:close={close} />
        {/each}
      {:else}
        <p>{noResultMsg(query)}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search {
    position: relative;
    min-width: 10rem;
  }

  input {
    color: var(--search-input-color, inherit);
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 3pt;
    padding: 0.35em 0.6em;
    width: 100%;
    box-sizing: border-box;
    font: inherit;
  }

  input::placeholder {
    color: var(--search-input-color, currentColor);
    opacity: 0.75;
  }

  .panel {
    position: absolute;
    right: 0;
    top: calc(100% + 0.5rem);
    width: min(90vw, 32rem);
    max-height: min(70vh, 36rem);
    overflow: auto;
    white-space: normal;
    background: var(--dark-orange);
    color: white;
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 35%);
    border-radius: 3pt;
    padding: 0.5rem;
  }

  .panel > p {
    margin: 0.5rem;
  }
</style>
