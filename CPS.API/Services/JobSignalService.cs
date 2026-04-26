using System.Threading.Channels;
using System.Threading.Tasks;

namespace CPS.API.Services
{
    public interface IJobSignalService
    {
        void SignalNewJob();
        Task WaitForJobAsync(CancellationToken cancellationToken);
    }

    public class JobSignalService : IJobSignalService
    {
        private readonly Channel<int> _channel;

        public JobSignalService()
        {
            _channel = Channel.CreateBounded<int>(new BoundedChannelOptions(100)
            {
                FullMode = BoundedChannelFullMode.DropOldest
            });
        }

        public void SignalNewJob()
        {
            _channel.Writer.TryWrite(1);
        }

        public async Task WaitForJobAsync(CancellationToken cancellationToken)
        {
            await _channel.Reader.ReadAsync(cancellationToken);
        }
    }
}
