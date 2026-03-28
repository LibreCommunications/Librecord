namespace Librecord.Domain;

public interface IUnitOfWork
{
    Task ExecuteInTransactionAsync(Func<Task> action);
    Task SaveChangesAsync();
}
