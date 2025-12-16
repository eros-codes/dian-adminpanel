import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquare, User, Reply, CheckCircle, Clock, Loader2, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Comment {
  id: string;
  name: string;
  email: string;
  message: string;
  adminReply: string | null;
  isReplied: boolean;
  createdAt: string;
}

const Comments: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all comments
  const { data: comments, isLoading } = useQuery({
    queryKey: ['admin', 'comments'],
    queryFn: async () => {
      return (await apiService.getAllComments()) as unknown as Comment[];
    },
  });

  // Remove reply mutation
  const removeReplyMutation = useMutation({
    mutationFn: async (id: string) => await apiService.removeCommentReply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      toast({ title: t('common.success'), description: t('comments.replyRemoved') });
    },
    onError: () => { toast({ title: t('common.error'), description: t('comments.deleteReplyError'), variant: 'destructive' }); },
  });

  // Reply to comment mutation
  const replyMutation = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      if (selectedComment?.isReplied) {
        return await apiService.updateCommentReply(id, reply);
      } else {
        return await apiService.replyToComment(id, reply);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
      toast({
        title: t('common.success'),
        description: t('comments.replySaved'),
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('comments.replyError'),
        variant: 'destructive',
      });
    },
  });

  const handleOpenReply = (comment: Comment) => {
    setSelectedComment(comment);
    setReplyText(comment.adminReply || '');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setSelectedComment(null);
    setReplyText('');
    setIsDialogOpen(false);
  };

  const handleSubmitReply = () => {
    if (!selectedComment || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedComment.id, reply: replyText.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Normalize to array in case API returns an envelope
  const list: Comment[] = Array.isArray(comments)
    ? comments
    : (comments && Array.isArray((comments as Record<string, unknown>).data))
      ? (comments as Record<string, unknown>).data as Comment[]
      : (comments && Array.isArray((comments as Record<string, unknown>).items))
        ? (comments as Record<string, unknown>).items as Comment[]
        : [];

  const isRepliedComputed = (c: Comment) => !!(c.adminReply && c.adminReply.toString().trim().length > 0);
  const pendingComments = list.filter(c => !isRepliedComputed(c));
  const repliedComments = list.filter(c => isRepliedComputed(c));

  return (
    <div className="space-y-6">
      {/* Page Header with compact stats one line below the title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          {t('navigation.comments')}
        </h1>
        <div className="flex items-center gap-3 overflow-x-auto mt-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            <span className="text-lg sm:text-xl font-bold">{list.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
            <Clock className="h-5 w-5 text-orange-500" />
            <span className="text-lg sm:text-xl font-bold">{pendingComments.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-lg sm:text-xl font-bold">{repliedComments.length}</span>
          </div>
        </div>
        <p className="text-muted-foreground mt-2">{t('comments.manage')}</p>
      </div>

      {/* Pending Comments */}
      {pendingComments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              {t('comments.pendingListTitle', { count: pendingComments.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingComments.map((comment) => (
              <Card key={comment.id} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                        <User className="h-4 w-4" />
                        <span className="font-semibold">{comment.name}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[70vw] sm:max-w-none">{comment.email}</span>
                        <Badge variant="secondary">
                          {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                        </Badge>
                      </div>
                      <p className="text-foreground break-words">{comment.message}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-end shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => handleOpenReply(comment)}
                        title={t('comments.reply')}
                        className="h-9 w-9 p-0"
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Replied Comments */}
      {repliedComments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t('comments.repliedListTitle', { count: repliedComments.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {repliedComments.map((comment) => (
              <Card key={comment.id} className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                          <User className="h-4 w-4" />
                          <span className="font-semibold">{comment.name}</span>
                          <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[70vw] sm:max-w-none">{comment.email}</span>
                          <Badge variant="secondary">
                            {new Date(comment.createdAt).toLocaleDateString('fa-IR')}
                          </Badge>
                        </div>
                        <p className="text-foreground break-words">{comment.message}</p>
                        {comment.adminReply && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 mt-2">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                              {t('comments.supportReplyLabel')}
                            </p>
                            <p className="text-foreground break-words">{comment.adminReply}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 justify-end shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => handleOpenReply(comment)}
                          title={t('comments.editReply')}
                          className="h-9 w-9 p-0"
                        >
                          <Reply className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => removeReplyMutation.mutate(comment.id)}
                          disabled={removeReplyMutation.isPending}
                          title={t('comments.deleteReply')}
                          className="h-9 w-9 p-0"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {list.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">{t('comments.empty')}</p>
          </CardContent>
        </Card>
      )}

      {/* Reply Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedComment?.isReplied ? t('comments.editReplyTitle') : t('comments.replyTitle')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedComment && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  <span className="font-semibold">{selectedComment.name}</span>
                </div>
                <p className="text-sm">{selectedComment.message}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('comments.replyYourText')}</label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('comments.replyPlaceholder')}
                  className="min-h-[150px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmitReply}
              disabled={!replyText.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('comments.sending')}
                </>
              ) : (
                t('comments.submitReply')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comments;
