import type { Channel, IdeaSummary, Organization } from "./types";

export const BUFFER_API = process.env.BUFFER_API_URL || "https://api.buffer.com";

export class BufferAuthError extends Error {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

/** Executes a GraphQL operation. Always uses variables, never string interpolation. */
export async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 401) throw new BufferAuthError("Buffer session expired. Please reconnect.");
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retryAfter?: number };
    throw new Error(`Buffer rate limit reached. Try again in ${body.retryAfter ?? 60}s.`);
  }
  const json = (await res.json().catch(() => ({}))) as GraphQLResponse<T>;
  if (json.errors?.length) {
    const first = json.errors[0];
    if (first.extensions?.code === "UNAUTHORIZED") throw new BufferAuthError(first.message);
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!res.ok || !json.data) throw new Error(`Buffer API error (${res.status}).`);
  return json.data;
}

const ORGS_AND_CHANNELS = /* GraphQL */ `
  query Organizations {
    account {
      organizations { id name }
    }
  }
`;

const CHANNELS = /* GraphQL */ `
  query Channels($input: ChannelsInput!) {
    channels(input: $input) {
      id
      name
      displayName
      service
      avatar
      isDisconnected
      isLocked
      isQueuePaused
      timezone
    }
  }
`;

export async function fetchOrganizations(token: string): Promise<Organization[]> {
  const { account } = await gql<{ account: { organizations: { id: string; name: string }[] } }>(
    token,
    ORGS_AND_CHANNELS,
  );
  return Promise.all(
    account.organizations.map(async (org) => {
      const { channels } = await gql<{ channels: Channel[] }>(token, CHANNELS, {
        input: { organizationId: org.id },
      });
      return { ...org, channels };
    }),
  );
}

const IDEAS = /* GraphQL */ `
  query Ideas($input: IdeasInput!, $first: Int) {
    ideas(input: $input, first: $first) {
      edges {
        node {
          id
          content {
            title
            text
            media { url type }
          }
        }
      }
    }
  }
`;

interface IdeaNode {
  id: string;
  content: { title: string | null; text: string | null; media: { url: string; type: string }[] | null };
}

export async function fetchIdeas(token: string, organizationId: string): Promise<IdeaSummary[]> {
  const { ideas } = await gql<{ ideas: { edges: { node: IdeaNode }[] } }>(token, IDEAS, {
    input: { organizationId },
    first: 25,
  });
  return ideas.edges.map(({ node }) => ({
    id: node.id,
    title: node.content.title,
    text: node.content.text,
    mediaUrl:
      node.content.media?.find((m) => m.type === "image" || m.type === "video")?.url ?? null,
  }));
}

// createIdea returns a union: select both success shapes and the error interface.
export const CREATE_IDEA = /* GraphQL */ `
  mutation CreateIdea($input: CreateIdeaInput!) {
    createIdea(input: $input) {
      __typename
      ... on Idea { id }
      ... on IdeaResponse { idea { id } }
      ... on MutationError { message }
    }
  }
`;

export type CreateIdeaResult =
  | { __typename: "Idea"; id: string }
  | { __typename: "IdeaResponse"; idea: { id: string } | null }
  | { __typename: string; message: string };

// createPost returns a union: PostActionSuccess or a MutationError implementation.
export const CREATE_POST = /* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post { id status dueAt channelId ideaId }
      }
      ... on MutationError { message }
    }
  }
`;

export type CreatePostResult =
  | {
      __typename: "PostActionSuccess";
      post: { id: string; status: string; dueAt: string | null; channelId: string; ideaId: string | null };
    }
  | { __typename: string; message: string };
