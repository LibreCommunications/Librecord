using Librecord.Domain;
using Microsoft.EntityFrameworkCore;

namespace Librecord.Infra.Database;

public class UnitOfWork : IUnitOfWork
{
    private readonly LibrecordContext _db;

    public UnitOfWork(LibrecordContext db)
    {
        _db = db;
    }

    public Task ExecuteInTransactionAsync(Func<Task> action)
    {
        var strategy = _db.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            await action();
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
        });
    }

    public Task SaveChangesAsync()
    {
        return _db.SaveChangesAsync();
    }
}
