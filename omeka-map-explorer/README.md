# Svelte Interactive Map Visualization for Omeka S Collection

This project is an interactive visualization application for newspaper article locations from an Omeka S collection, built with SvelteKit.

## Project Status

We are following the roadmap outlined in the [original design document](../README.md).

### Completed Tasks:

- [x] ✅ Project setup with SvelteKit, TypeScript, and required dependencies
- [x] ✅ Project structure creation 
- [x] ✅ TypeScript type definitions
- [x] ✅ Environment configuration
- [x] ✅ Core API service (Omeka S API integration)
- [x] ✅ GeoJSON data service 
- [x] ✅ Data processing utilities
- [x] ✅ State management with Svelte stores
- [x] ✅ Base Map component
- [x] ✅ Choropleth layer for visualizing data density
- [x] ✅ Timeline component for temporal visualization
- [x] ✅ Animation controller for timeline playback
- [x] ✅ Filter panel with country and date filters
- [x] ✅ Main application UI layout
- [x] ✅ Server-side rendering (SSR) compatibility
- [x] ✅ Timeline accessibility improvements

### In Progress:

- [ ] 🚧 Integrating real data from Omeka S (currently using mock data)
- [ ] 🚧 Improving filter interactions
- [ ] 🚧 Additional accessibility improvements

### Upcoming Tasks:

- [ ] Advanced features (data export, shareable views)
- [ ] Backend requirements (API proxy, data pre-processing)
- [ ] Testing & QA
- [ ] Deployment & Documentation

## Development

### Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example` and add your Omeka S API credentials

4. Start the development server:

```bash
npm run dev
```

### SSR Compatibility

The application uses client-side libraries like Leaflet and D3 that depend on browser APIs. To ensure compatibility with SvelteKit's server-side rendering:

1. We've disabled SSR for the main page using `export const ssr = false` in `+page.ts`
2. All components dynamically import browser-dependent libraries
3. We check for the `browser` environment before executing client-side code
4. Components have fallback displays for server-rendering

### Accessibility

The application supports accessibility in the following ways:

1. The timeline supports keyboard navigation (arrow keys to move through time)
2. Interactive elements have appropriate ARIA attributes
3. Focus states are visually indicated

### Known Issues

- Several TypeScript linting errors related to type definitions for third-party libraries
- The timeline keyboard navigation could be improved for finer control
- Form controls need additional accessibility improvements

### Testing

To run tests:

```bash
npm test
```

## License

This project is licensed under the MIT License.
