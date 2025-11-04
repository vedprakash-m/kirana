# Storybook Setup Guide

**Status:** Ready for Implementation  
**Last Updated:** 2025-11-03  
**Owner:** Frontend Team

## Overview

This guide documents the Storybook configuration for Kirana's component library. Storybook provides an isolated environment for developing and testing UI components independently from the application.

## Quick Start

```bash
# Install Storybook
cd frontend
npx storybook@latest init

# Start Storybook dev server
npm run storybook

# Build static Storybook
npm run build-storybook

# Deploy to GitHub Pages
npm run deploy-storybook
```

## Configuration

### Installation Commands

```bash
# Initialize Storybook (auto-detects React + Vite)
npx storybook@latest init

# Install addons
npm install --save-dev @storybook/addon-a11y @storybook/addon-coverage @chromaui/addon-visual-tests

# Install interaction testing
npm install --save-dev @storybook/testing-library @storybook/jest
```

### Storybook Configuration Files

**`.storybook/main.ts`** (Storybook configuration):
```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-coverage',
    '@chromaui/addon-visual-tests'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {
    autodocs: 'tag'
  },
  staticDirs: ['../public']
};

export default config;
```

**`.storybook/preview.ts`** (Global decorators and parameters):
```typescript
import type { Preview } from '@storybook/react';
import '../src/index.css'; // Import global styles

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
        { name: 'dashboard', value: '#f5f5f5' }
      ]
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' }
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' }
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' }
        }
      }
    }
  }
};

export default preview;
```

## Component Stories

### 1. ItemCard Component

**File:** `src/components/ItemCard.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ItemCard } from './ItemCard';

const meta: Meta<typeof ItemCard> = {
  title: 'Components/ItemCard',
  component: ItemCard,
  tags: ['autodocs'],
  argTypes: {
    urgency: {
      control: 'select',
      options: ['critical', 'warning', 'normal']
    },
    predictionConfidence: {
      control: 'select',
      options: ['high', 'medium', 'low', 'teach_mode']
    }
  }
};

export default meta;
type Story = StoryObj<typeof ItemCard>;

// Critical urgency story
export const Critical: Story = {
  args: {
    item: {
      id: '1',
      canonicalName: 'Whole Milk',
      category: 'DAIRY',
      predictedRunOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      predictionConfidence: 'high',
      urgency: 'critical',
      daysUntilRunOut: 2,
      lastRestocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      averageConsumptionRate: 0.5,
      packageSize: 1,
      packageUnit: 'GALLONS'
    },
    onRestock: () => console.log('Restock clicked'),
    onEdit: () => console.log('Edit clicked')
  }
};

// Warning urgency story
export const Warning: Story = {
  args: {
    item: {
      ...Critical.args.item,
      predictedRunOutDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: 'warning',
      daysUntilRunOut: 5
    }
  }
};

// Normal urgency story
export const Normal: Story = {
  args: {
    item: {
      ...Critical.args.item,
      predictedRunOutDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: 'normal',
      daysUntilRunOut: 14
    }
  }
};

// Low confidence story
export const LowConfidence: Story = {
  args: {
    item: {
      ...Critical.args.item,
      predictionConfidence: 'low',
      daysUntilRunOut: 7
    }
  }
};

// Teach mode story (no prediction)
export const TeachMode: Story = {
  args: {
    item: {
      ...Critical.args.item,
      predictionConfidence: 'teach_mode',
      predictedRunOutDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntilRunOut: 7
    }
  }
};
```

### 2. ConfidenceBadge Component

**File:** `src/components/ConfidenceBadge.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ConfidenceBadge } from './ConfidenceBadge';

const meta: Meta<typeof ConfidenceBadge> = {
  title: 'Components/ConfidenceBadge',
  component: ConfidenceBadge,
  tags: ['autodocs'],
  argTypes: {
    confidence: {
      control: 'select',
      options: ['high', 'medium', 'low', 'teach_mode']
    }
  }
};

export default meta;
type Story = StoryObj<typeof ConfidenceBadge>;

export const High: Story = {
  args: {
    confidence: 'high',
    factors: [
      { factor: 'min_transactions', met: true, value: 5 },
      { factor: 'consistent_intervals', met: true, value: 0.15 },
      { factor: 'recent_data', met: true, value: true },
      { factor: 'no_outliers', met: true, value: true }
    ]
  }
};

export const Medium: Story = {
  args: {
    confidence: 'medium',
    factors: [
      { factor: 'min_transactions', met: true, value: 3 },
      { factor: 'consistent_intervals', met: false, value: 0.35 },
      { factor: 'recent_data', met: true, value: true }
    ]
  }
};

export const Low: Story = {
  args: {
    confidence: 'low',
    factors: [
      { factor: 'min_transactions', met: false, value: 2 },
      { factor: 'consistent_intervals', met: false, value: 0.55 }
    ]
  }
};

export const TeachMode: Story = {
  args: {
    confidence: 'teach_mode',
    factors: [
      { factor: 'teach_mode', met: true, value: 'weekly' }
    ]
  }
};
```

### 3. EmptyState Component

**File:** `src/components/EmptyState.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoItems: Story = {
  args: {
    icon: 'ShoppingCart',
    title: 'No items yet',
    description: 'Get started by adding your first grocery item',
    actionLabel: 'Add Item',
    onAction: () => console.log('Add item clicked')
  }
};

export const NoResults: Story = {
  args: {
    icon: 'Search',
    title: 'No items found',
    description: 'Try adjusting your filters or search terms',
    actionLabel: 'Clear Filters',
    onAction: () => console.log('Clear filters clicked')
  }
};

export const AllStocked: Story = {
  args: {
    icon: 'CheckCircle',
    title: 'All items stocked!',
    description: 'You have no items running out soon',
    actionLabel: null,
    onAction: null
  }
};
```

### 4. TeachModeQuickEntry Component

**File:** `src/components/TeachModeQuickEntry.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { TeachModeQuickEntry } from './TeachModeQuickEntry';

const meta: Meta<typeof TeachModeQuickEntry> = {
  title: 'Components/TeachModeQuickEntry',
  component: TeachModeQuickEntry,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof TeachModeQuickEntry>;

export const Default: Story = {
  args: {
    onSubmit: (data) => console.log('Submitted:', data)
  }
};

export const WithDefaultValues: Story = {
  args: {
    defaultValues: {
      itemName: 'Whole Milk',
      frequency: 'weekly'
    },
    onSubmit: (data) => console.log('Submitted:', data)
  }
};

export const Loading: Story = {
  args: {
    isSubmitting: true,
    onSubmit: (data) => console.log('Submitted:', data)
  }
};
```

### 5. CSVUploadBanner Component

**File:** `src/components/CSVUploadBanner.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { CSVUploadBanner } from './CSVUploadBanner';

const meta: Meta<typeof CSVUploadBanner> = {
  title: 'Components/CSVUploadBanner',
  component: CSVUploadBanner,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof CSVUploadBanner>;

export const Default: Story = {
  args: {
    onUpload: (file) => console.log('File uploaded:', file.name),
    budgetRemaining: 42.50,
    budgetCap: 50
  }
};

export const LowBudget: Story = {
  args: {
    onUpload: (file) => console.log('File uploaded:', file.name),
    budgetRemaining: 8.25,
    budgetCap: 50
  }
};

export const BudgetExceeded: Story = {
  args: {
    onUpload: (file) => console.log('File uploaded:', file.name),
    budgetRemaining: 0,
    budgetCap: 50,
    isDisabled: true
  }
};

export const Uploading: Story = {
  args: {
    onUpload: (file) => console.log('File uploaded:', file.name),
    budgetRemaining: 42.50,
    budgetCap: 50,
    isUploading: true,
    progress: 65
  }
};
```

### 6. MicroReview Component

**File:** `src/components/MicroReview.stories.tsx`

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MicroReview } from './MicroReview';

const meta: Meta<typeof MicroReview> = {
  title: 'Components/MicroReview',
  component: MicroReview,
  tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof MicroReview>;

export const ImportPreview: Story = {
  args: {
    items: [
      { itemName: 'Whole Milk', category: 'DAIRY', confidence: 0.95 },
      { itemName: 'Organic Eggs', category: 'DAIRY', confidence: 0.88 },
      { itemName: 'Sourdough Bread', category: 'BAKERY', confidence: 0.92 }
    ],
    onApprove: () => console.log('Approved'),
    onReject: () => console.log('Rejected'),
    onEdit: (index, newName) => console.log('Edit item', index, newName)
  }
};

export const LowConfidence: Story = {
  args: {
    items: [
      { itemName: 'Whole Milk', category: 'DAIRY', confidence: 0.95 },
      { itemName: 'Unknown Product', category: 'OTHER', confidence: 0.45 },
      { itemName: 'Eggs', category: 'DAIRY', confidence: 0.88 }
    ],
    onApprove: () => console.log('Approved'),
    onReject: () => console.log('Rejected'),
    onEdit: (index, newName) => console.log('Edit item', index, newName)
  }
};

export const SingleItem: Story = {
  args: {
    items: [
      { itemName: 'Whole Milk', category: 'DAIRY', confidence: 0.95 }
    ],
    onApprove: () => console.log('Approved'),
    onReject: () => console.log('Rejected'),
    onEdit: (index, newName) => console.log('Edit item', index, newName)
  }
};
```

## Visual Regression Testing

### Chromatic Integration

```bash
# Install Chromatic
npm install --save-dev chromatic

# Add script to package.json
{
  "scripts": {
    "chromatic": "chromatic --project-token=<PROJECT_TOKEN>"
  }
}

# Run visual regression tests
npm run chromatic
```

### GitHub Actions Workflow

**`.github/workflows/chromatic.yml`**:
```yaml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]
    paths:
      - 'frontend/src/**'
      - 'frontend/.storybook/**'

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run Chromatic
        uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          workingDir: frontend
```

## Deployment to GitHub Pages

### Build and Deploy Script

```bash
# Build Storybook
npm run build-storybook

# Deploy to GitHub Pages (manual)
npx gh-pages -d storybook-static

# Or use GitHub Actions
```

**`.github/workflows/storybook-deploy.yml`**:
```yaml
name: Deploy Storybook

on:
  push:
    branches: [main]
    paths:
      - 'frontend/src/**'
      - 'frontend/.storybook/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Build Storybook
        run: cd frontend && npm run build-storybook
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/storybook-static
```

## Accessibility Testing

All stories automatically run accessibility tests via `@storybook/addon-a11y`. Check the "Accessibility" tab in Storybook to view:
- ARIA labels
- Color contrast
- Keyboard navigation
- Focus management

## Best Practices

1. **Component Isolation**: Each story should render the component in isolation
2. **Multiple States**: Create stories for all meaningful component states (loading, error, empty)
3. **Interactive Controls**: Use argTypes to make props interactive in Storybook UI
4. **Documentation**: Add JSDoc comments that auto-generate in Storybook docs
5. **Accessibility**: Test all stories with keyboard and screen reader
6. **Visual Regression**: Run Chromatic on every PR to catch visual bugs

## Storybook URL

After deployment, Storybook is available at:
- **Production**: https://kirana-team.github.io/kirana/
- **Local**: http://localhost:6006/

## References

- [Storybook Documentation](https://storybook.js.org/docs/react/get-started/introduction)
- [Storybook with Vite](https://storybook.js.org/docs/react/builders/vite)
- [Chromatic Visual Testing](https://www.chromatic.com/docs/)
- [Accessibility Addon](https://storybook.js.org/addons/@storybook/addon-a11y)
