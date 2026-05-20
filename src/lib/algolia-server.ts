type AlgoliaIndexConfig = {
  name: string
  getData: () => Promise<Record<string, unknown>[]>
}

type AlgoliaConfig = {
  appId: string
  apiKey: string
  indices: AlgoliaIndexConfig[]
  settings?: Record<string, unknown>
}

async function algoliaRequest(
  appId: string,
  apiKey: string,
  path: string,
  method: 'POST' | 'PUT',
  body: unknown
) {
  const response = await fetch(`https://${appId}.algolia.net/1/${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-algolia-api-key': apiKey,
      'x-algolia-application-id': appId,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Algolia request failed (${response.status}) for ${path}`)
  }
}

export async function indexAlgolia({ appId, apiKey, indices, settings }: AlgoliaConfig) {
  await Promise.all(
    indices.map(async ({ name, getData }) => {
      const objects = await getData()

      if (settings) {
        await algoliaRequest(appId, apiKey, `indexes/${encodeURIComponent(name)}/settings`, 'PUT', settings)
      }

      await algoliaRequest(appId, apiKey, `indexes/${encodeURIComponent(name)}/batch`, 'POST', {
        requests: objects.map((object) => ({
          action: 'addObject',
          body: {
            ...object,
            objectID: object.id || object.slug || object.title,
          },
        })),
      })
    })
  )
}
