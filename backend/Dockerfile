# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/ControleGastos.Api/ControleGastos.Api.csproj src/ControleGastos.Api/
RUN dotnet restore src/ControleGastos.Api/ControleGastos.Api.csproj

COPY . .
RUN dotnet publish src/ControleGastos.Api/ControleGastos.Api.csproj \
    -c Release -o /app/publish /p:UseAppHost=false

# ---------- runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "ControleGastos.Api.dll"]
