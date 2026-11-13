# Cascade — Buffer API Notes

## Auth

Register an App Client. Use OAuth 2.0 Authorization Code + PKCE.

Scopes: `account:read`, `posts:read`, `posts:write`, `ideas:read`, `ideas:write`, `offline_access`.

## List channels

```graphql
query {
  channels(input: { organizationId: "ORG_ID" }) {
    id
    name
    service
  }
}
```

## Save idea

```graphql
mutation {
  createIdea(input: {
    organizationId: "ORG_ID"
    content: {
      title: "Optional title"
      text: "Original idea text"
    }
  }) {
    ... on Idea { id }
    ... on MutationError { message }
  }
}
```

## Create post

```graphql
mutation {
  createPost(input: {
    text: "Adapted text for this channel"
    channelId: "CHANNEL_ID"
    schedulingType: automatic
    mode: addToQueue
    assets: [{ image: { url: "https://..." } }]
    ideaId: "IDEA_ID"
  }) {
    ... on PostActionSuccess { post { id status dueAt } }
    ... on MutationError { message }
  }
}
```

## Notes

- One `createPost` call per channel.
- Media must be a public URL.
- Metrics require a personal API key. App Clients cannot request them.
- Always select both success and error fragments on mutations.
