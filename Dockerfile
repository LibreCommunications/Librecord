FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Librecord.sln ./
COPY Librecord.Api/Librecord.Api.csproj Librecord.Api/
COPY Librecord.Application/Librecord.Application.csproj Librecord.Application/
COPY Librecord.Domain/Librecord.Domain.csproj Librecord.Domain/
COPY Librecord.Infra/Librecord.Infra.csproj Librecord.Infra/
COPY Librecord.Tests/Librecord.Tests.csproj Librecord.Tests/
RUN dotnet restore Librecord.sln

COPY . .
RUN dotnet publish Librecord.Api/Librecord.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

EXPOSE 5111
ENTRYPOINT ["dotnet", "Librecord.Api.dll"]
