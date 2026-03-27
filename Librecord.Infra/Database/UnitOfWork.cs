using Librecord.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Librecord.Infra.Database;

public class UnitOfWork : IUnitOfWork
{
    private readonly LibrecordContext _db;
    private IDbContextTransaction? _transaction;

    public UnitOfWork(LibrecordContext db)
    {
        _db = db;
    }

    public async Task<IAsyncDisposable> BeginTransactionAsync()
    {
        _transaction = await _db.Database.BeginTransactionAsync();
        return _transaction;
    }

    public async Task CommitAsync()
    {
        if (_transaction == null)
            throw new InvalidOperationException("No active transaction.");
        await _db.SaveChangesAsync();
        await _transaction.CommitAsync();
    }

    public async Task RollbackAsync()
    {
        if (_transaction != null)
            await _transaction.RollbackAsync();
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
