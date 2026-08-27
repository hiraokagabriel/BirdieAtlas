'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateClubModal } from '@/components/club/create-club-modal';
import { EditClubModal } from '@/components/club/edit-club-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Club {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  athleteCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [deletingClub, setDeletingClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      setError(null);
      const data = await apiFetch<Club[]>('/clubs');
      setClubs(data);
    } catch (error) {
      console.error('Failed to load clubs:', error);
      setError('Erro ao carregar clubes. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingClub) return;

    try {
      await apiFetch(`/clubs/${deletingClub.id}`, { method: 'DELETE' });
      setClubs(clubs.filter((c) => c.id !== deletingClub.id));
    } catch (error) {
      console.error('Failed to delete club:', error);
      setError('Erro ao excluir clube. Tente novamente.');
    } finally {
      setDeletingClub(null);
    }
  }

  function handleCreateSuccess() {
    setIsCreateOpen(false);
    loadClubs();
  }

  function handleEditSuccess() {
    setEditingClub(null);
    loadClubs();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Clubes</h1>
          <p className="text-muted-foreground">
            Gerencie os clubes e suas informações
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Clube
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Lista de Clubes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando clubes...
            </div>
          ) : clubs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum clube cadastrado. Clique em "Novo Clube" para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Localidade</TableHead>
                  <TableHead>Atletas</TableHead>
                  <TableHead className="text-right">Açııes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">{club.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {club.slug}
                    </TableCell>
                    <TableCell>
                      {[club.city, club.state, club.country]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      {club.athleteCount !== undefined ? (
                        <span className="text-sm">{club.athleteCount}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingClub(club)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingClub(club)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateClubModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreateSuccess}
      />

      {editingClub && (
        <EditClubModal
          open={true}
          onOpenChange={() => setEditingClub(null)}
          club={editingClub}
          onSuccess={handleEditSuccess}
        />
      )}

      <AlertDialog
        open={!!deletingClub}
        onOpenChange={() => setDeletingClub(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir clube?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O clube "{deletingClub?.name}"
              será permanentemente removido do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
