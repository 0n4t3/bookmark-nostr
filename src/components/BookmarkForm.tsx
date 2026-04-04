import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useBookmarkPublish } from '@/hooks/useBookmarkPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const bookmarkSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  title: z.string().optional(),
  description: z.string().optional(),
  tagInput: z.string().optional(),
});

type BookmarkFormData = z.infer<typeof bookmarkSchema>;

interface BookmarkFormProps {
  onSuccess?: () => void;
  initialUrl?: string;
  initialTitle?: string;
}

export function BookmarkForm({ onSuccess, initialUrl = '', initialTitle = '' }: BookmarkFormProps) {
  const { user } = useCurrentUser();
  const { mutate: createBookmark, isPending } = useBookmarkPublish();
  const [tags, setTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<BookmarkFormData>({
    resolver: zodResolver(bookmarkSchema),
    defaultValues: {
      url: initialUrl,
      title: initialTitle,
      description: '',
      tagInput: '',
    },
  });

  const tagInput = watch('tagInput');

  const addTag = () => {
    if (tagInput && tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setValue('tagInput', '');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = (data: BookmarkFormData) => {
    if (!user) {
      toast.error('You must be logged in to create bookmarks');
      return;
    }

    createBookmark(
      {
        url: data.url,
        title: data.title || undefined,
        description: data.description || '',
        tags,
      },
      {
        onSuccess: () => {
          toast.success('Bookmark created');
          reset();
          setTags([]);
          onSuccess?.();
        },
        onError: (error) => {
          console.error('Failed to create bookmark:', error);
          toast.error('Failed to create bookmark');
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Please log in to add bookmarks.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="url" className="text-xs">url *</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://example.com"
          {...register('url')}
          disabled={isPending}
          className="h-7 text-sm bg-card"
        />
        {errors.url && (
          <p className="text-xs text-destructive">{errors.url.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="title" className="text-xs">title</Label>
        <Input
          id="title"
          placeholder="Page title (optional)"
          {...register('title')}
          disabled={isPending}
          className="h-7 text-sm bg-card"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className="text-xs">description</Label>
        <Textarea
          id="description"
          placeholder="Notes about this bookmark (optional)"
          rows={3}
          {...register('description')}
          disabled={isPending}
          className="text-sm bg-card"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="tagInput" className="text-xs">tags</Label>
        <div className="flex gap-2">
          <Input
            id="tagInput"
            placeholder="Type and press enter"
            {...register('tagInput')}
            onKeyPress={handleKeyPress}
            disabled={isPending}
            className="h-7 text-sm bg-card"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addTag}
            disabled={!tagInput?.trim() || isPending}
            className="h-7 w-7"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs flex items-center gap-1">
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-destructive shrink-0"
                  disabled={isPending}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="h-7 text-sm w-fit px-4">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Saving...
          </>
        ) : (
          'save'
        )}
      </Button>
    </form>
  );
}
