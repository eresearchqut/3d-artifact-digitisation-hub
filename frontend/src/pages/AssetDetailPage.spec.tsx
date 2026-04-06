import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AssetDetailPage } from './AssetDetailPage';
import { assetService } from '../services/api.service';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

vi.mock('../services/api.service', () => ({
  assetService: {
    findOne: vi.fn(),
    generateUploadUrl: vi.fn()
  }
}));

vi.mock('../components/SplatViewer', () => ({
  SplatViewer: ({ url }: { url: string }) => <div data-testid="splat-viewer">{url}</div>
}));

vi.mock('../components/FilePicker/FilePicker', () => ({
  FilePicker: ({ onFileSelect }: { onFileSelect: (f: File) => void }) => (
    <button data-testid="file-picker" onClick={() => {
      const file = new File(['dummy content'], 'test.ply', { type: 'application/octet-stream' });
      Object.defineProperty(file, 'size', { value: 1024 });
      onFileSelect(file);
    }}>
      Upload File
    </button>
  )
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('AssetDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const renderWithProviders = (initialRoute = '/asset/test-123') => {
    return render(
      <ChakraProvider value={defaultSystem}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/asset/:id" element={<AssetDetailPage />} />
              <Route path="/asset" element={<div>Assets List</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ChakraProvider>
    );
  };

  it('renders loading state initially', () => {
    vi.mocked(assetService.findOne).mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders();
    expect(screen.getByText(/Loading asset details/i)).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    vi.mocked(assetService.findOne).mockRejectedValue(new Error('Failed to fetch'));
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Error loading asset details/i)).toBeInTheDocument();
    });
  });

  it('renders asset details and splat viewer when successful', async () => {
    vi.mocked(assetService.findOne).mockResolvedValue({ id: 'test-123', key: 'assets/test-123.ply', metadata: {} } as any);
    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('assets/test-123.ply')).toBeInTheDocument();
    });
    
    expect(screen.getByTestId('splat-viewer')).toHaveTextContent('http://localhost:3000/asset/test-123/file');
  });

  it('handles file upload correctly', async () => {
    vi.mocked(assetService.findOne).mockResolvedValue({ id: 'test-123', key: 'assets/test-123.ply', metadata: {} } as any);
    vi.mocked(assetService.generateUploadUrl).mockResolvedValue({ id: 'new-id', uploadUrl: 'http://mock-upload-url' });
    
    global.fetch = vi.fn().mockResolvedValue({ ok: true, statusText: 'OK' } as Response);

    renderWithProviders();
    
    await waitFor(() => {
      expect(screen.getByText('assets/test-123.ply')).toBeInTheDocument();
    });

    const uploadButton = screen.getByTestId('file-picker');
    userEvent.click(uploadButton);

    await waitFor(() => {
      expect(assetService.generateUploadUrl).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://mock-upload-url', expect.objectContaining({
        method: 'PUT'
      }));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/File uploaded successfully/i)).toBeInTheDocument();
    });
  });
});
