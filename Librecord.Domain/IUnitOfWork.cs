namespace Librecord.Domain;

public interface IUnitOfWork
{
    Task<IAsyncDisposable> BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
    Task SaveChangesAsync();
}
