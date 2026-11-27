export const examples = {
  shop: {
    label: 'Noodle shop', title: 'Midnight Noodles', location: 'South A / Market Row',
    prompt: 'Open a late-night noodle shop in the empty South A storefront. Give players a bowl they can order and eat.',
    plan: ['Use the vacant storefront and keep the door and sidewalk clear.', 'Open from 18:00 to 02:00 with one vendor.', 'Reuse the city’s food counter, payment and eating interactions.'],
    check: 'Street access', evidence: 'The sample counter and stools fit inside the shop.',
    lane: 'standard', image: 'shop', action: 'Order noodles', response: 'Bowl served. You can eat it at the counter.'
  },
  object: {
    label: '3D prop', title: 'Market Row repair stand', location: 'South A / Market Row',
    prompt: 'Add a compact bicycle repair stand beside the storefront, with space for people to walk past.',
    plan: ['Place the stand inside the shop’s frontage.', 'Use a small collision footprint.', 'Record the model source and redistribution license.'],
    check: 'Pedestrian clearance', evidence: 'The sample stand fits inside the frontage.',
    lane: 'standard', image: 'street'
  },
  street: {
    label: 'Street detail', title: 'Market Row streetlights', location: 'South A / Market Row',
    prompt: 'Replace two dim streetlights on Market Row with warmer lights. Keep the existing poles and curb layout.',
    plan: ['Reuse the existing poles and power connections.', 'Set two fixtures to warm white.', 'Keep junctions, lanes and pedestrian routes intact.'],
    check: 'Street layout', evidence: 'The sample edits fixture settings only.',
    lane: 'standard', image: 'street'
  },
  weather: {
    label: 'Weather', title: 'Harbor rain', location: 'Waterfront / Weather',
    prompt: 'Add a brief evening drizzle near the harbor. Wet the pavement gradually and let it dry after the shower.',
    plan: ['Use the city’s existing rain and road-wetness settings.', 'Limit the effect to the harbor during the evening.', 'Check the boundary, transition timing and driving conditions.'],
    check: 'Weather and handling', evidence: 'District weather affects shared driving conditions. The release owner reviews the transition and scope.',
    lane: 'maintainer', image: 'street'
  },
  tunnel: {
    label: 'Tunnel & water', title: 'Harbor maintenance tunnel', location: 'Waterfront / Below street level',
    prompt: 'Add a maintenance tunnel under the harbor with a service hatch and a drain into the existing water network.',
    plan: ['Use the service yard as the entrance.', 'Model a short underground route with an exit.', 'Connect the drain to the existing service network.'],
    check: 'Underground systems', evidence: 'The tunnel connects to shared water and navigation systems. A maintainer checks collisions, escape routes and flooding.',
    lane: 'maintainer', image: 'street'
  },
  gameplay: {
    label: 'Gameplay', title: 'After-hours shop scenario', location: 'South A / Market Row',
    prompt: 'Let players attempt a fictional shop robbery in-game, with a witness reaction and the city’s existing wanted system.',
    plan: ['Use the game’s existing store, witness and wanted states.', 'Preview how NPCs and the wanted state react in the game.', 'Check how the store resets when the encounter ends.'],
    check: 'Mission and NPC behavior', evidence: 'Changes to shared crime and NPC behavior need a maintainer to play through the scenario and check recovery.',
    lane: 'maintainer', image: 'shop'
  },
  rollout: {
    label: 'Release rule', title: 'Stage new shop content', location: 'Citywide / Release process',
    prompt: 'Release new shop content to a preview build first. Put it in the public build after a smoke test passes.',
    plan: ['Build a preview from the proposed release configuration.', 'Require a storefront interaction smoke test.', 'Keep a reference to the previous public build for rollback.'],
    check: 'Release permissions', evidence: 'A release maintainer must approve changes to publication gates and rollback behavior.',
    lane: 'maintainer', image: 'street'
  },
  powers: {
    label: 'Superpowers', title: 'Flight ability', location: 'South A / Player abilities',
    prompt: 'Give players the power to fly over South A and land anywhere in the shared city.',
    plan: ['Add flight as a player ability.', 'Expose it in the shared city.'],
    check: 'Grounded city', evidence: 'Superpowers are outside the shared-city rules. Rewrite this as a grounded traversal idea, such as access to a legal rooftop viewpoint.',
    lane: 'declined', image: 'street'
  },
  roads: {
    label: 'Major road edit', title: 'Waterfront highway', location: 'South A / Street network',
    prompt: 'Replace the existing South A street grid with a six-lane elevated highway through the waterfront.',
    plan: ['Replace several streets and junctions.', 'Reroute local traffic through a new highway.'],
    check: 'Protected street grid', evidence: 'Major street redesigns are outside this contribution lane. Propose a small lighting, signage or street-prop update within the existing layout.',
    lane: 'declined', image: 'street'
  }
};

export function makeDraft(key, prompt) {
  const example = examples[key];
  if (prompt === example.prompt) return { ...example, prompt, key };

  return {
    ...example, title: 'Custom proposal', prompt, key, lane: 'custom',
    action: null,
    plan: ['Attach the request and location to the draft.', 'Have an agent propose file changes and a playable preview.', 'Have the reviewer evaluate the actual files against the city rules.'],
    check: 'Review pending',
    evidence: 'This prototype can capture your idea. A connected agent and a review of the actual changes are required to make a decision.'
  };
}
