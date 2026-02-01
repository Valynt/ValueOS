FROM kong:3.9

USER root
RUN mkdir -p /var/lib/kong
COPY kong.yml /var/lib/kong/kong.yml
RUN chown -R kong:kong /var/lib/kong

USER kong
