# NextDNS integration

This environment is configured to route all DNS traffic from devcontainer and services through NextDNS for security, filtering, and logging.

- The NextDNS proxy runs as a container on a user-defined bridge network (`devnet`) with static IP `172.28.0.53`.
- All services and the devcontainer are configured to use this IP as their DNS resolver.
- Environment variables are set in `.env.devcontainer`:
  - `NEXTDNS_CONFIG_ID=4479bb`
  - `NEXTDNS_DEVICE_NAME=valueos-devcontainer`
- Compose files: `compose.nextdns.yml` and `docker-compose.override.yml` handle the proxy and network wiring.

## To verify DNS routing

Inside the devcontainer, run:

    cat /etc/resolv.conf
    nslookup github.com
    nslookup registry.npmjs.org
    curl -I https://api.github.com

You should see DNS queries succeed and appear in your NextDNS dashboard under the configured device name.

For more, see compose.nextdns.yml and the main setup docs.
